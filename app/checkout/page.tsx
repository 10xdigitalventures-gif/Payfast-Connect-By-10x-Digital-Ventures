"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

// HighLevel loads this page in an iframe (paymentsUrl) during customer
// checkout (funnels, invoices, payment links, subscriptions).
//
// Per official GHL docs:
//   1. We send  -> { type: 'custom_provider_ready', loaded: true, addCardOnFileSupported: true }
//   2. GHL sends -> { type: 'payment_initiate_props', amount, currency,
//                     transactionId, orderId, subscriptionId, locationId, contact, mode }
//   3. We open PayFast in a popup, poll our backend, and notify GHL ONLY
//      after the payment is actually confirmed (success/fail/cancel).
//
// IMPORTANT: the terminal message (custom_element_success_response) is sent
// AFTER real confirmation, never at form-creation time. Sending it early
// makes GHL mark the invoice paid and tear down this iframe mid-redirect
// (the "stuck" bug).

interface GHLPaymentData {
  amount: number;
  currency: string;
  contactId: string;
  locationId: string;
  invoiceId?: string;
  orderId?: string;
  subscriptionId?: string;
  transactionId: string;
  description?: string;
  mode?: "payment" | "setup";
  productDetails?: { productId?: string; priceId?: string };
  contact?: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    contact?: string;
  };
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — hosted checkout + OTP can be slow

function readUrlPayData(): GHLPaymentData | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const amount = parseFloat(p.get("amount") || "");
  const locationId = p.get("locationId") || "";
  if (!amount || !locationId) return null;

  return {
    amount,
    currency: p.get("currency") || "PKR",
    contactId: p.get("contactId") || "",
    locationId,
    invoiceId: p.get("invoiceId") || undefined,
    orderId: p.get("orderId") || undefined,
    subscriptionId: p.get("subscriptionId") || undefined,
    transactionId: p.get("transactionId") || p.get("ghlTransactionId") || "",
    description: p.get("description") || undefined,
    contact: {
      name: p.get("name") || "",
      email: p.get("email") || "",
      phone: p.get("phone") || "",
    },
  };
}

type Stage = "form" | "waiting" | "success" | "failed";

export default function CheckoutPage() {
  const [payData, setPayData] = useState<GHLPaymentData | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pfForm, setPfForm] = useState<{
    actionUrl: string;
    fields: Record<string, string>;
  } | null>(null);
  const [waitingForGhl, setWaitingForGhl] = useState(true);
  const [debugMsg, setDebugMsg] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [statusMsg, setStatusMsg] = useState("");
  const [providers, setProviders] = useState<{
    payfast: boolean;
    whop: boolean;
  }>({ payfast: true, whop: false });
  const [method, setMethod] = useState<"payfast" | "whop">("payfast");
  const [routing, setRouting] = useState<{
    oneoff: "payfast" | "whop";
    subscription: "payfast" | "whop";
  }>({ oneoff: "payfast", subscription: "whop" });

  const payDataRef = useRef<GHLPaymentData | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadline = useRef<number>(0);
  const basketRef = useRef<string>("");
  const finishedRef = useRef<boolean>(false); // terminal message fires once
  const dbgWrapRef = useRef<HTMLDivElement | null>(null);
  const dbgBodyRef = useRef<HTMLDivElement | null>(null);
  const dbgLinesRef = useRef<string[]>([]);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  function logEvent(dir: "in" | "out" | "info", text: string) {
    const ts = new Date().toLocaleTimeString();
    const color =
      dir === "in" ? "#4ade80" : dir === "out" ? "#fbbf24" : "#94a3b8";
    const arrow = dir === "in" ? "⬇ IN" : dir === "out" ? "⬆ OUT" : "ℹ";
    const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const line =
      '<div style="color:' +
      color +
      '"><span style="color:#64748b">' +
      ts +
      "</span> " +
      arrow +
      " " +
      safe +
      "</div>";
    dbgLinesRef.current = [...dbgLinesRef.current.slice(-60), line];
    try {
      console.log("[checkout " + dir + "]", text);
    } catch {
      /* ignore */
    }
    const body = dbgBodyRef.current;
    if (body) {
      body.innerHTML = dbgLinesRef.current.join("");
      body.scrollTop = body.scrollHeight;
    }
  }

  // GHL frequently nests the payment iframe, so window.parent may be an
  // intermediate frame while the window that dispatches payment_initiate_props
  // is window.top (or another ancestor). Broadcasting to every ancestor makes
  // the handshake reliable regardless of nesting depth.
  function postToAncestors(payload: Record<string, unknown> | string) {
    const targets = new Set<Window>();
    try {
      if (window.parent && window.parent !== window) targets.add(window.parent);
    } catch {
      /* ignore */
    }
    try {
      if (window.top && window.top !== window)
        targets.add(window.top as Window);
    } catch {
      /* ignore */
    }
    try {
      if (
        window.parent &&
        window.parent.parent &&
        window.parent.parent !== window
      )
        targets.add(window.parent.parent);
    } catch {
      /* ignore */
    }
    let n = 0;
    targets.forEach((w) => {
      try {
        w.postMessage(payload, "*");
        n++;
      } catch {
        /* ignore */
      }
    });
    return n;
  }

  // Floating on-screen log so we can SEE which postMessage events fire inside
  // the GHL iframe (enable with ?debug=1, and auto-shown if we get stuck).
  function ensureDbgOverlay() {
    if (dbgWrapRef.current || typeof document === "undefined") return;
    const wrap = document.createElement("div");
    wrap.setAttribute(
      "style",
      "position:fixed;left:8px;right:8px;bottom:8px;max-height:42vh;overflow:auto;z-index:2147483647;background:rgba(2,6,23,0.94);color:#e2e8f0;font:11px/1.55 ui-monospace,Menlo,monospace;border-radius:10px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.45)",
    );
    const hdr = document.createElement("div");
    hdr.setAttribute(
      "style",
      "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px",
    );
    hdr.innerHTML =
      '<strong style="color:#38bdf8">GHL postMessage debug</strong>';
    const btn = document.createElement("button");
    btn.textContent = "clear";
    btn.setAttribute(
      "style",
      "background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:6px;cursor:pointer;font:11px ui-monospace,monospace;padding:2px 10px",
    );
    btn.onclick = () => {
      dbgLinesRef.current = [];
      if (dbgBodyRef.current) dbgBodyRef.current.innerHTML = "";
    };
    hdr.appendChild(btn);
    const body = document.createElement("div");
    wrap.appendChild(hdr);
    wrap.appendChild(body);
    document.body.appendChild(wrap);
    dbgWrapRef.current = wrap;
    dbgBodyRef.current = body;
    if (dbgLinesRef.current.length) {
      body.innerHTML = dbgLinesRef.current.join("");
      body.scrollTop = body.scrollHeight;
    }
  }

  function notifyGhl(payload: Record<string, unknown>) {
    const n = postToAncestors(payload);
    logEvent("out", String(payload.type) + " → " + n + " ancestor(s)");
  }

  function finishSuccess(chargeId: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopPolling();
    setStage("success");
    setStatusMsg("Payment confirmed.");
    notifyGhl({ type: "custom_element_success_response", chargeId });
  }

  function finishError(message: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopPolling();
    setStage("failed");
    setError(message);
    notifyGhl({
      type: "custom_element_error_response",
      error: { description: message },
    });
  }

  function finishCancel() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopPolling();
    try {
      popupRef.current?.close();
    } catch {
      /* ignore */
    }
    notifyGhl({ type: "custom_element_close_response" });
    setStage("form");
    setLoading(false);
    setPfForm(null);
  }

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("debug") === "1" || sp.get("debug") === "true")
        ensureDbgOverlay();
    } catch {
      /* ignore */
    }
    const fromUrl = readUrlPayData();
    if (fromUrl) {
      setPayData(fromUrl);
      payDataRef.current = fromUrl;
      setWaitingForGhl(false);
      if (fromUrl.contact) {
        setForm({
          name: fromUrl.contact.name || "",
          email: fromUrl.contact.email || "",
          phone: fromUrl.contact.phone || fromUrl.contact.contact || "",
        });
      }
    }

    const receivedTypes = new Set<string>();

    function handleMessage(event: MessageEvent) {
      // HighLevel may send its iframe events as either an object or a
      // stringified JSON payload. Accept both formats.
      let d: any = event.data;
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return;
        }
      }
      if (!d || typeof d !== "object") return;
      if (
        typeof d.source === "string" &&
        d.source.indexOf("react-devtools") === 0
      )
        return;

      if (typeof d.type === "string") receivedTypes.add(d.type);
      logEvent(
        "in",
        (d.type || "(no type)") +
          " from " +
          (event.origin || "(null)") +
          " · keys: " +
          (Object.keys(d).join(", ") || "—"),
      );

      const amountNum =
        typeof d.amount === "string" ? parseFloat(d.amount) : d.amount;
      const isSetupInit =
        d.type === "setup_initiate_props" || d.mode === "setup";
      const isPaymentInit =
        isSetupInit ||
        d.type === "payment_initiate_props" ||
        d.type === "payment-init" ||
        d.type === "payment_initiate" ||
        (typeof amountNum === "number" &&
          !Number.isNaN(amountNum) &&
          (d.locationId || d.transactionId || d.orderId || d.invoiceId));

      if (isPaymentInit) {
        const incoming: GHLPaymentData = {
          amount: isSetupInit ? 0 : Number(amountNum),
          currency: d.currency || "PKR",
          contactId: d.contact?.id || d.contactId || "",
          locationId: d.locationId,
          invoiceId: d.invoiceId,
          orderId: d.orderId,
          subscriptionId: d.subscriptionId,
          transactionId: d.transactionId || d.ghlTransactionId || "",
          description: d.description,
          mode: d.mode,
          productDetails: d.productDetails,
          contact: d.contact,
        };
        setPayData(incoming);
        payDataRef.current = incoming;
        if (isSetupInit) setMethod("whop");
        setWaitingForGhl(false);
        if (incoming.contact) {
          setForm({
            name: incoming.contact.name || "",
            email: incoming.contact.email || "",
            phone: incoming.contact.phone || incoming.contact.contact || "",
          });
        }
        setDebugMsg("");
      }
    }
    window.addEventListener("message", handleMessage);

    // Announce readiness to HighLevel. GHL sends payment_initiate_props only
    // AFTER it receives our ready signal, and its parent listener may not be
    // attached the instant our iframe mounts — so we broadcast repeatedly
    // until the payment context arrives (fixes the race that left the page
    // stuck on "No payment context received").
    try {
      const ao = (window.location as any).ancestorOrigins;
      const origins = ao
        ? Array.from(ao as ArrayLike<string>).join(", ")
        : "(n/a)";
      logEvent(
        "info",
        "inIframe=" +
          (window !== window.top) +
          " · referrer=" +
          (document.referrer || "—") +
          " · ancestorOrigins=[" +
          origins +
          "]",
      );
    } catch {
      /* ignore */
    }
    let readyAttempts = 0;
    const sendReady = () => {
      // The custom-provider handshake specifically requires a stringified
      // JSON payload. Send it to every likely GHL ancestor to support nested
      // iframe layouts.
      const payload = JSON.stringify({
        type: "custom_provider_ready",
        loaded: true,
        addCardOnFileSupported: true,
      });
      const n = postToAncestors(payload);
      readyAttempts++;
      logEvent("out", "custom_provider_ready → " + n + " ancestor(s)");
    };
    sendReady();
    const readyTimer = setInterval(() => {
      if (payDataRef.current || readyAttempts >= 30) {
        clearInterval(readyTimer);
        return;
      }
      sendReady();
    }, 500);

    const t = setTimeout(() => {
      clearInterval(readyTimer);
      if (!payDataRef.current) {
        setWaitingForGhl(false);
        ensureDbgOverlay();
        setDebugMsg(
          "No payment context received from HighLevel. " +
            "If you opened this URL directly, please return to your CRM and use the payment link/funnel/invoice button." +
            (receivedTypes.size
              ? " [received: " + Array.from(receivedTypes).join(", ") + "]"
              : " [no messages received from parent]"),
        );
      }
    }, 15000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(readyTimer);
      clearTimeout(t);
      stopPolling();
      try {
        dbgWrapRef.current?.remove();
        dbgWrapRef.current = null;
        dbgBodyRef.current = null;
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Submit the PayFast form INTO the popup window (not this iframe).
  useEffect(() => {
    if (!pfForm) return;
    const frm = document.getElementById(
      "pfSubmitForm",
    ) as HTMLFormElement | null;
    if (frm) setTimeout(() => frm.submit(), 200);
  }, [pfForm]);

  // Detect which payment providers this location has enabled.
  useEffect(() => {
    const loc = payData?.locationId;
    if (!loc) return;
    let cancelled = false;
    fetch(`/api/checkout/providers?locationId=${encodeURIComponent(loc)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const next = { payfast: d.payfast !== false, whop: !!d.whop };
        setProviders(next);

        // Admin routing: pick the provider configured for this payment type
        // (one-time → route_oneoff, subscription → route_subscription).
        const route = d.routing || { oneoff: "payfast", subscription: "whop" };
        setRouting({
          oneoff: route.oneoff === "whop" ? "whop" : "payfast",
          subscription: route.subscription === "payfast" ? "payfast" : "whop",
        });
        const isSub = !!payDataRef.current?.subscriptionId;
        const preferred: "payfast" | "whop" = isSub
          ? route.subscription === "payfast"
            ? "payfast"
            : "whop"
          : route.oneoff === "whop"
            ? "whop"
            : "payfast";
        // Honour the routing choice when that provider is configured; otherwise
        // fall back to whichever provider is available.
        const chosen: "payfast" | "whop" =
          preferred === "whop"
            ? next.whop
              ? "whop"
              : next.payfast
                ? "payfast"
                : "whop"
            : next.payfast
              ? "payfast"
              : next.whop
                ? "whop"
                : "payfast";
        setMethod(chosen);
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [payData?.locationId]);

  async function pollOnce() {
    if (finishedRef.current) return;
    const p = payDataRef.current;
    if (!p || !basketRef.current) return;

    if (Date.now() > pollDeadline.current) {
      finishError(
        "Payment timed out. No confirmation was received from PayFast.",
      );
      return;
    }

    try {
      const qs = new URLSearchParams({
        basketId: basketRef.current,
        locationId: p.locationId,
      });
      const res = await fetch(`/api/ghl/payment-status?${qs.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) return; // transient — keep polling
      const data = (await res.json()) as {
        status: "paid" | "pending" | "failed";
        chargeId?: string;
      };

      if (data.status === "paid") {
        finishSuccess(data.chargeId || basketRef.current);
      } else if (data.status === "failed") {
        finishError("Payment was declined or cancelled.");
      }
      // pending -> keep polling
    } catch {
      // network blip — keep polling until timeout
    }
  }

  function startPolling() {
    stopPolling();
    pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
    pollTimer.current = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    void pollOnce();
  }

  async function pay() {
    if (!payData) return;
    if (!form.email.includes("@")) {
      setError("Valid email required");
      return;
    }
    if (!form.name.trim()) {
      setError("Name required");
      return;
    }

    // Open the popup SYNCHRONOUSLY on the click, before any await, or the
    // browser popup blocker kills it.
    const popup = window.open(
      "about:blank",
      "payfastPopup",
      "width=500,height=720",
    );
    if (!popup) {
      setError("Please allow popups for this site, then press Pay again.");
      return;
    }
    popupRef.current = popup;

    setLoading(true);
    setError("");

    try {
      if (payData.mode === "setup") {
        const setupRes = await fetch("/api/whop/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId: payData.locationId,
            contactId: payData.contactId,
            email: form.email,
            name: form.name,
          }),
        });
        const setupData = await setupRes.json().catch(() => ({}));
        if (!setupRes.ok || !setupData?.redirectUrl || !setupData?.basketId) {
          throw new Error(
            setupData?.error || "Could not start secure card setup.",
          );
        }
        basketRef.current = setupData.basketId;
        popup.location.href = setupData.redirectUrl;
        setStage("waiting");
        setStatusMsg(
          "Add your card in the secure Whop window. No payment will be charged.",
        );
        startPolling();
        return;
      }
      if (method === "whop") {
        const wRes = await fetch("/api/whop/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locationId: payData.locationId,
            contactId: payData.contactId,
            ghlTransactionId: payData.transactionId,
            invoiceId: payData.invoiceId,
            orderId: payData.orderId,
            subscriptionId: payData.subscriptionId,
            frequency:
              (payData as any).recurring?.interval ||
              (payData as any).frequency ||
              "",
            amount: payData.amount,
            currency: payData.currency,
            description: payData.description || "Payment",
            nameFirst: form.name.split(" ")[0],
            nameLast: form.name.split(" ").slice(1).join(" ") || ".",
            email: form.email,
            phone: form.phone,
          }),
        });
        const wData = await wRes.json().catch(() => ({}));
        if (!wRes.ok)
          throw new Error(
            wData?.error || `Payment initiation failed (${wRes.status})`,
          );
        if (!wData?.redirectUrl || !wData?.basketId) {
          throw new Error("Invalid payment response from server");
        }
        basketRef.current = wData.basketId;
        try {
          popup.location.href = wData.redirectUrl;
        } catch {
          /* popup navigation blocked */
        }
        setStage("waiting");
        setStatusMsg("Complete your payment in the secure Whop window.");
        startPolling();
        return;
      }

      const res = await fetch("/api/ghl/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: payData.locationId,
          contactId: payData.contactId,
          ghlTransactionId: payData.transactionId,
          invoiceId: payData.invoiceId,
          orderId: payData.orderId,
          subscriptionId: payData.subscriptionId,
          amount: payData.amount,
          currency: payData.currency,
          description: payData.description || "Payment",
          nameFirst: form.name.split(" ")[0],
          nameLast: form.name.split(" ").slice(1).join(" ") || ".",
          email: form.email,
          phone: form.phone,
          isRecurring: !!payData.subscriptionId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.error || `Payment initiation failed (${res.status})`,
        );
      if (!data?.actionUrl || !data?.fields || !data?.basketId) {
        throw new Error("Invalid payment response from server");
      }

      // Hand the popup the PayFast form and start watching for the REAL result.
      basketRef.current = data.basketId;
      setStage("waiting");
      setStatusMsg("Complete your payment in the secure PayFast window.");
      setPfForm({ actionUrl: data.actionUrl, fields: data.fields });
      startPolling();
      // NOTE: no success message here — it fires from pollOnce() once confirmed.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      try {
        popupRef.current?.close();
      } catch {
        /* ignore */
      }
      finishError(msg);
    }
  }

  const inp = {
    width: "100%",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "12px 16px",
    color: "#0F172A",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  } as const;

  const methodCard = {
    background: "white",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  } as const;
  const methodLabel = {
    fontSize: 13,
    fontWeight: 600,
    color: "#0F172A",
    marginBottom: 12,
  } as const;
  const methodGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  } as const;
  const methodBtn = (active: boolean) => ({
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start" as const,
    gap: 4,
    padding: "12px 14px",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left" as const,
    background: active ? "rgba(0,82,255,0.06)" : "#F8FAFC",
    border: active ? "2px solid #0052FF" : "1px solid #E2E8F0",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  });
  const methodName = {
    fontSize: 13,
    fontWeight: 600,
    color: "#0F172A",
  } as const;
  const methodHint = { fontSize: 11, color: "#64748B" } as const;

  const shell = (children: ReactNode) => (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "grid",
        placeItems: "center",
        fontFamily: "DM Sans, sans-serif",
        padding: 20,
      }}
    >
      <div style={{ textAlign: "center", color: "#0F172A", maxWidth: 440 }}>
        {children}
      </div>
    </div>
  );

  // Hidden form that posts into the popup (rendered whenever we have it).
  const hiddenForm = pfForm ? (
    <form
      id="pfSubmitForm"
      action={pfForm.actionUrl}
      method="POST"
      target="payfastPopup"
      style={{ display: "none" }}
    >
      {Object.entries(pfForm.fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </form>
  ) : null;

  if (stage === "success") {
    return shell(
      <>
        <div style={{ fontSize: 40, color: "#22C55E", marginBottom: 10 }}>
          ✓
        </div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
          Payment confirmed
        </p>
        <p style={{ color: "#64748B", fontSize: 14 }}>{statusMsg}</p>
        {hiddenForm}
      </>,
    );
  }

  if (stage === "failed") {
    return shell(
      <>
        <div style={{ fontSize: 36, color: "#EF4444", marginBottom: 10 }}>
          ⚠️
        </div>
        <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
          Payment not completed
        </p>
        <p style={{ color: "#64748B", fontSize: 14, marginBottom: 16 }}>
          {error}
        </p>
        <button
          onClick={() => {
            finishedRef.current = false;
            setError("");
            setStage("form");
            setLoading(false);
            setPfForm(null);
          }}
          style={{
            minHeight: 44,
            padding: "0 22px",
            background: "#0052FF",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Try again
        </button>
      </>,
    );
  }

  if (stage === "waiting") {
    return shell(
      <>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⏳</div>
        <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
          Waiting for payment…
        </p>
        <p
          style={{
            color: "#64748B",
            fontSize: 14,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {statusMsg} This page updates automatically once your payment is
          confirmed.
        </p>
        <button
          onClick={finishCancel}
          style={{
            minHeight: 44,
            minWidth: 120,
            padding: "0 20px",
            background: "#fff",
            color: "#0F172A",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel payment
        </button>
        {hiddenForm}
      </>,
    );
  }

  if (waitingForGhl && !payData) {
    return shell(
      <div style={{ color: "#64748B", fontSize: 14 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        Loading payment details…
      </div>,
    );
  }

  if (!payData) {
    return shell(
      <div style={{ color: "#64748B", fontSize: 14 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontWeight: 600, color: "#0F172A", marginBottom: 8 }}>
          Unable to load payment information.
        </p>
        <p style={{ marginBottom: 14 }}>
          {debugMsg ||
            "Please open this page inside the HighLevel checkout iframe."}
        </p>
        <p style={{ fontSize: 12, color: "#94A3B8" }}>
          If this persists, check that Payfast Connect is set as Default in your
          CRM:
          <br />
          <strong>
            Payments → Integrations → Payfast Connect → Set as Default
          </strong>
        </p>
      </div>,
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily: "DM Sans, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          background: "white",
          borderBottom: "1px solid #E2E8F0",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "#0052FF",
              borderRadius: 7,
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L4.5 13H11L10 22L19.5 11H13Z" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: 700,
              fontSize: 13,
              color: "#0F172A",
            }}
          >
            Secure Checkout
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#64748B",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: "#22C55E",
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
          SSL · GoPayFast
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: "24px 20px",
          maxWidth: 440,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "white",
            border: "1px solid #E2E8F0",
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>
            {payData.mode === "setup"
              ? "Save payment method"
              : payData.description ||
                (payData.subscriptionId
                  ? "Subscription Payment"
                  : "Amount Due")}
          </div>
          {payData.mode !== "setup" && (
            <div
              style={{
                fontFamily: "var(--font-head)",
                fontSize: 32,
                fontWeight: 800,
                color: "#0052FF",
              }}
            >
              {payData.currency || "PKR"}{" "}
              {Number(payData.amount).toLocaleString("en-PK", {
                minimumFractionDigits: 2,
              })}
            </div>
          )}
          {payData.subscriptionId && (
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
              Recurring subscription · Auto-charged
            </div>
          )}
        </div>

        {payData.mode !== "setup" && providers.payfast && providers.whop && (
          <div style={methodCard}>
            <div style={methodLabel}>Payment Method</div>
            <div style={methodGrid}>
              <button
                type="button"
                onClick={() => setMethod("payfast")}
                style={methodBtn(method === "payfast")}
              >
                <span style={methodName}>GoPayFast</span>
                <span style={methodHint}>Cards &amp; bank · PKR</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("whop")}
                style={methodBtn(method === "whop")}
              >
                <span style={methodName}>Whop</span>
                <span style={methodHint}>Card, BNPL &amp; crypto</span>
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            background: "white",
            border: "1px solid #E2E8F0",
            borderRadius: 14,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#0F172A",
              marginBottom: 14,
            }}
          >
            Your Details
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#64748B",
                  marginBottom: 5,
                  display: "block",
                }}
              >
                Full Name *
              </label>
              <input
                style={inp}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Your full name"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#64748B",
                  marginBottom: 5,
                  display: "block",
                }}
              >
                Email *
              </label>
              <input
                style={inp}
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#64748B",
                  marginBottom: 5,
                  display: "block",
                }}
              >
                Phone
              </label>
              <input
                style={inp}
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+92 300 0000000"
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              color: "#EF4444",
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={pay}
          disabled={loading}
          style={{
            width: "100%",
            background: "#0052FF",
            color: "white",
            border: "none",
            padding: "14px",
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? "Processing…"
            : payData.mode === "setup"
              ? "Save card securely with Whop →"
              : `Pay ${payData.currency || "PKR"} ${Number(payData.amount).toLocaleString()}${providers.payfast && providers.whop ? (method === "whop" ? " with Whop" : " with GoPayFast") : ""} →`}
        </button>

        <div
          style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: 11,
            color: "#94A3B8",
          }}
        >
          🔒 Secured by GoPayFast · 10x Digital Ventures
        </div>
      </div>
    </div>
  );
}
