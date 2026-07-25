import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getMerchantAccessToken,
  performTokenizedTransaction,
} from "@/lib/payfast";
import {
  getPaymentInstruments,
  getPaymentInstrumentByProviderMethod,
} from "@/lib/payment-instruments";

// CRM sends various queries here:
// - verify: confirm payment status
// - refund: process refund
// - subscription_cancel: cancel subscription

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    type,
    locationId,
    ghlTransactionId,
    chargeId,
    subscriptionId,
    amount,
    instrumentId,
    instrumentToken,
    paymentMethodId,
    email,
    nameFirst,
    nameLast,
    phone,
    description,
    contactId,
  } = body;

  console.log("[CRM Query]", type, { locationId, ghlTransactionId, chargeId });

  const toEpoch = (value: unknown) => {
    const date = value ? new Date(value as string) : null;
    return date && !Number.isNaN(date.getTime())
      ? Math.floor(date.getTime() / 1000)
      : Math.floor(Date.now() / 1000);
  };

  const buildChargeSnapshot = (payment: any) => {
    const status =
      payment.status === "complete"
        ? "succeeded"
        : payment.status === "failed"
          ? "failed"
          : "pending";
    return {
      id:
        payment.pf_payment_id ||
        chargeId ||
        ghlTransactionId ||
        payment.pf_token ||
        String(payment.id),
      status,
      amount: Number(payment.amount || 0),
      chargeId:
        payment.pf_payment_id ||
        chargeId ||
        ghlTransactionId ||
        payment.pf_token ||
        String(payment.id),
      chargedAt: toEpoch(payment.updated_at || payment.created_at),
    };
  };

  const buildSubscriptionSnapshot = (payment: any, subRow: any) => {
    if (!payment && !subRow && !subscriptionId) return null;

    const now = Math.floor(Date.now() / 1000);
    const status =
      subRow?.status ||
      (payment?.payment_type === "subscription" &&
      payment?.status === "complete"
        ? "active"
        : null) ||
      "pending";

    return {
      id:
        subRow?.provider_membership_id ||
        subRow?.ghl_subscription_id ||
        subRow?.id ||
        subscriptionId ||
        payment?.pf_token ||
        String(payment?.id || ""),
      status: status === "trial" ? "trialing" : status,
      trialEnd: subRow?.trial_ends_at ? toEpoch(subRow.trial_ends_at) : 0,
      createdAt: toEpoch(subRow?.created_at || payment?.created_at),
      nextCharge: subRow?.next_charge_at
        ? toEpoch(subRow.next_charge_at)
        : subRow?.current_period_end
          ? toEpoch(subRow.current_period_end)
          : payment?.payment_type === "subscription"
            ? now + 30 * 24 * 60 * 60
            : 0,
    };
  };

  const resolveSavedMethod = async () => {
    // HighLevel always supplies contactId for saved-method actions. Never fall
    // back to a location-wide card, because that could charge another contact.
    const methods = await getPaymentInstruments(locationId, contactId || null);
    const selectedMethod = instrumentToken
      ? methods.find((method) => method.instrument_token === instrumentToken)
      : methods.find(
          (method) =>
            String(method.id) === String(instrumentId || paymentMethodId) ||
            method.provider_payment_method_id === String(paymentMethodId || ""),
        ) ||
        methods.find((method) => method.is_default) ||
        null;
    return { methods, selectedMethod };
  };

  const monthCountForFrequency = (value?: string | null) => {
    if (value === "annual" || value === "6") return 12;
    if (value === "quarterly" || value === "4") return 3;
    return 1;
  };

  switch (type) {
    case "ContactUpdate":
    case "OpportunityCreate":
    case "OpportunityUpdate":
    case "OpportunityStatusUpdate":
    case "InvoiceCreate":
    case "InvoiceSent":
    case "InvoiceUpdate":
    case "ContactTagUpdate": {
      return NextResponse.json({ success: true, type, locationId });
    }

    case "INSTALL": {
      if (!locationId) {
        return NextResponse.json(
          { error: "locationId required" },
          { status: 400 },
        );
      }

      await query(
        `INSERT INTO installations (location_id, access_token, refresh_token, expires_at)
         VALUES (?, '', '', NOW())
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [locationId],
      );

      return NextResponse.json({ success: true, locationId });
    }

    case "UNINSTALL": {
      if (!locationId) {
        return NextResponse.json(
          { error: "locationId required" },
          { status: 400 },
        );
      }

      await query("DELETE FROM installations WHERE location_id = ?", [
        locationId,
      ]);
      return NextResponse.json({ success: true, locationId });
    }

    // ── Verify Payment ──────────────────────────────────────
    case "verify": {
      // Require apiKey for verification requests
      // Validate API key via helper (headers-only)
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "verify",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const rows = await query<any[]>(
        `SELECT * FROM payments WHERE (pf_payment_id = ? OR custom_str3 = ?) AND location_id = ? LIMIT 1`,
        [chargeId, ghlTransactionId, locationId],
      );

      if (!rows.length) {
        return NextResponse.json({ success: false });
      }

      const p = rows[0];
      const subscriptionRows =
        p.payment_type === "subscription"
          ? await query<any[]>(
              `SELECT * FROM ghl_provider_subscriptions
             WHERE location_id = ? AND (ghl_transaction_id = ? OR ghl_subscription_id = ?)
             ORDER BY id DESC LIMIT 1`,
              [locationId, ghlTransactionId || "", subscriptionId || ""],
            )
          : [];
      const subRow = subscriptionRows[0] || null;
      const chargeSnapshot = buildChargeSnapshot(p);
      const subscriptionSnapshot = buildSubscriptionSnapshot(p, subRow);
      return NextResponse.json({
        success: p.status === "complete",
        failed: p.status === "failed",
        message:
          p.status === "complete"
            ? "Payment verified"
            : p.status === "failed"
              ? "Payment failed"
              : "Payment pending",
        chargeSnapshot,
        ...(subscriptionSnapshot
          ? {
              subscriptionStatus: subscriptionSnapshot.status,
              subscriptionSnapshot,
            }
          : {}),
      });
    }

    // ── Refund ───────────────────────────────────────────────
    case "refund": {
      // Require apiKey for refund requests
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "refund",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      // Determine which provider owns this charge so we route the refund correctly.
      const refundRows = await query<any[]>(
        `SELECT * FROM payments
           WHERE (pf_payment_id = ? OR pf_token = ? OR custom_str3 = ?) AND location_id = ?
           ORDER BY id DESC LIMIT 1`,
        [chargeId, chargeId, ghlTransactionId, locationId],
      );
      const refundPayment = refundRows[0] || null;
      if (!refundPayment) {
        return NextResponse.json(
          {
            success: false,
            failed: true,
            message: "Original payment was not found.",
          },
          { status: 404 },
        );
      }
      const requestedRefund = Number(amount || 0);
      if (!Number.isFinite(requestedRefund) || requestedRefund <= 0) {
        return NextResponse.json(
          {
            success: false,
            failed: true,
            message: "A positive refund amount is required.",
          },
          { status: 400 },
        );
      }
      const previousRefunds = await query<any[]>(
        `SELECT COALESCE(SUM(amount), 0) AS refunded FROM payment_refunds
         WHERE payment_id = ? AND status = 'succeeded'`,
        [refundPayment.id],
      );
      const alreadyRefunded = Number(previousRefunds[0]?.refunded || 0);
      const remaining = Number(refundPayment.amount) - alreadyRefunded;
      if (requestedRefund > remaining + 0.0001) {
        return NextResponse.json(
          {
            success: false,
            failed: true,
            message: `Refund exceeds remaining refundable amount (${remaining.toFixed(2)}).`,
          },
          { status: 400 },
        );
      }
      const refundProvider = refundPayment.provider || "payfast";

      if (refundProvider === "whop") {
        // Real Whop refund via POST /payments/{id}/refund.
        const whopInstRows = await query<any[]>(
          `SELECT * FROM installations WHERE location_id = ? LIMIT 1`,
          [locationId],
        );
        const whopApiKey = whopInstRows[0]?.whop_api_key || "";
        const whopPaymentId = refundPayment?.pf_payment_id || chargeId;

        if (!whopApiKey || !whopPaymentId) {
          return NextResponse.json({
            success: false,
            failed: true,
            message:
              "This payment was collected through Whop, but the Whop API key or payment id is missing. Please refund it from your Whop dashboard (Payments \u2192 Refund).",
          });
        }

        const { refundWhopPayment } = await import("@/lib/whop");
        const partial =
          amount != null && Number(amount) > 0 ? Number(amount) : undefined;
        const refundRes = await refundWhopPayment({
          apiKey: whopApiKey,
          paymentId: whopPaymentId,
          partialAmount: partial,
        });

        if (!refundRes.ok) {
          return NextResponse.json(
            {
              success: false,
              failed: true,
              message:
                refundRes.error ||
                "Whop refund failed. You can also refund it from your Whop dashboard.",
            },
            { status: 400 },
          );
        }

        const providerRefundId = String(
          refundRes.data?.id ||
            refundRes.data?.refund?.id ||
            `${whopPaymentId}:refund:${Date.now()}`,
        );
        await query(
          `INSERT INTO payment_refunds
            (payment_id, location_id, provider, provider_refund_id, amount, currency, status, raw_response)
           VALUES (?, ?, 'whop', ?, ?, 'USD', 'succeeded', ?)`,
          [
            refundPayment.id,
            locationId,
            providerRefundId,
            requestedRefund,
            JSON.stringify(refundRes.data || {}),
          ],
        );
        if (
          alreadyRefunded + requestedRefund >=
          Number(refundPayment.amount) - 0.0001
        ) {
          await query(`UPDATE payments SET status = 'refunded' WHERE id = ?`, [
            refundPayment.id,
          ]);
        }
        return NextResponse.json({
          success: true,
          message: "Refund successful",
          id: providerRefundId,
          amount: requestedRefund,
          currency: "USD",
        });
      }

      // Never report a refund until the provider has actually completed one.
      return NextResponse.json(
        {
          success: false,
          failed: true,
          message:
            "PayFast refunds must be completed through the merchant refund workflow; no local refund was recorded.",
        },
        { status: 501 },
      );
    }

    // ── List Payment Methods (for saved cards) ─────────────
    case "list_payment_methods": {
      // Require apiKey for listing saved payment methods
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "list_payment_methods",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      if (!locationId) {
        return NextResponse.json(
          { error: "locationId required" },
          { status: 400 },
        );
      }

      if (!contactId)
        return NextResponse.json(
          { error: "contactId required" },
          { status: 400 },
        );
      const methods = await getPaymentInstruments(locationId, contactId);
      return NextResponse.json(
        methods.map((method) => ({
          // Whop payment-method ID is the ID HighLevel gives back on charge_payment.
          id: method.provider_payment_method_id || method.instrument_token,
          type: "card",
          title:
            method.instrument_alias ||
            (method.provider === "whop" ? "Whop card" : "Card"),
          subTitle: `**** **** **** ${method.card_last_four || "****"}`,
          expiry: method.expiry_date || "",
          customerId: method.provider_customer_id || "",
        })),
      );
    }

    // ── Charge Payment Method (for saved cards) ─────────────
    case "charge_payment": {
      // Require apiKey for charging saved payment methods
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "charge_payment",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      if (!locationId || !contactId || !paymentMethodId || !amount) {
        return NextResponse.json(
          {
            error: "locationId, contactId, paymentMethodId and amount required",
          },
          { status: 400 },
        );
      }

      const installationRows = await query<any[]>(
        `SELECT * FROM installations WHERE location_id = ? LIMIT 1`,
        [locationId],
      );
      if (!installationRows.length) {
        return NextResponse.json(
          { error: "Installation not found for this location" },
          { status: 400 },
        );
      }

      const inst = installationRows[0];

      // Resolve the exact card returned by list_payment_methods for this contact.
      const selectedWhopMethod = await getPaymentInstrumentByProviderMethod(
        locationId,
        contactId,
        "whop",
        String(paymentMethodId),
      );
      if (selectedWhopMethod && inst.whop_api_key && inst.whop_company_id) {
        const {
          chargeWhopPaymentMethod,
          convertPkrToUsd,
          resolveExchangeRate,
        } = await import("@/lib/whop");
        const feePercent = Number(inst.whop_fee_percent ?? 10);
        const { rate } = await resolveExchangeRate(
          inst.whop_rate_mode,
          Number(inst.whop_exchange_rate ?? 280),
        );
        const usdAmount = convertPkrToUsd(Number(amount), feePercent, rate);

        const whopChargeBasketId =
          chargeId ||
          `CRM-WHOP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const whopRes = await chargeWhopPaymentMethod({
          apiKey: inst.whop_api_key,
          companyId: inst.whop_company_id || "",
          memberId: selectedWhopMethod.provider_customer_id || "",
          paymentMethodId: selectedWhopMethod.provider_payment_method_id || "",
          usdAmount,
          metadata: {
            location_id: locationId,
            ghl_transaction_id: ghlTransactionId || whopChargeBasketId,
            description: description || "Off-session charge",
          },
        });

        if (!whopRes.ok) {
          return NextResponse.json(
            {
              success: false,
              failed: true,
              message: whopRes.error || "Whop off-session charge failed.",
            },
            { status: 400 },
          );
        }

        const whopChargeId = whopRes.data?.id || whopChargeBasketId;
        const chargeSnapshot = {
          id: whopChargeId,
          status: "succeeded",
          amount: Number(amount),
          chargeId: whopChargeId,
          chargedAt: Math.floor(Date.now() / 1000),
        };

        await query(
          `INSERT INTO payments
            (location_id, contact_id, payer_email, amount, item_name, payment_type,
             provider, status, pf_token, pf_payment_id, custom_str2, custom_str3)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            locationId,
            contactId || null,
            email || `${locationId}@crm.local`,
            Number(amount),
            description || "Off-session charge",
            "one-time",
            "whop",
            "complete",
            whopChargeBasketId,
            whopChargeId,
            locationId,
            ghlTransactionId || "",
          ],
        );

        return NextResponse.json({
          success: true,
          failed: false,
          message: "Charge processed via Whop",
          chargeSnapshot,
        });
      }

      // ── PayFast off-session charge path (default) ─────────────────────────────
      if (!inst.merchant_id || !inst.merchant_key) {
        return NextResponse.json(
          {
            error:
              "No payment method available: GoPayFast is not configured and Whop off-session requires a stored payment method.",
          },
          { status: 400 },
        );
      }

      const { selectedMethod } = await resolveSavedMethod();

      if (!selectedMethod?.instrument_token) {
        return NextResponse.json(
          { error: "Saved payment method not found" },
          { status: 404 },
        );
      }

      const basketId =
        chargeId ||
        `CRM-CHARGE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const paymentLabel = description || "Saved card charge";
      const payerEmail = email || `${locationId}@crm.local`;
      const payerFirst = nameFirst || "";
      const payerLast = nameLast || ".";

      await query(
        `INSERT INTO payments
          (location_id, contact_id, payer_email, payer_first, payer_last,
           amount, item_name, item_description, payment_type, status, pf_token, custom_str1, custom_str2)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          locationId,
          contactId || null,
          payerEmail,
          payerFirst,
          payerLast,
          Number(amount),
          paymentLabel,
          JSON.stringify({
            instrumentId: selectedMethod.id,
            instrumentToken: selectedMethod.instrument_token,
          }),
          "one-time",
          "pending",
          basketId,
          selectedMethod.instrument_token,
          locationId,
        ],
      );

      try {
        const accessToken = await getMerchantAccessToken({
          merchantId: inst.merchant_id,
          merchantKey: inst.merchant_key,
          amount: Number(amount).toFixed(2),
          basketId,
        });

        const response = await performTokenizedTransaction({
          token: accessToken,
          instrumentToken: selectedMethod.instrument_token,
          transactionId: basketId,
          merchantUserId: inst.merchant_id,
          userMobileNumber: phone || payerEmail,
          basketId,
          orderDate: new Date().toISOString().slice(0, 19).replace("T", " "),
          description: paymentLabel,
          amount: Number(amount).toFixed(2),
          otp: "RECURRING",
        });

        const success =
          response?.status_code === "00" ||
          response?.code === "00" ||
          response?.status === "00";
        const paymentId =
          response?.transaction_id ||
          response?.transactionId ||
          response?.id ||
          basketId;

        await query(
          `UPDATE payments SET pf_payment_id = ?, status = ?, raw_itn = ? WHERE pf_token = ? AND location_id = ?`,
          [
            paymentId,
            success ? "complete" : "failed",
            JSON.stringify(response || {}),
            basketId,
            locationId,
          ],
        );

        const chargeSnapshot = {
          id: paymentId,
          status: success ? "succeeded" : "failed",
          amount: Number(amount),
          chargeId: paymentId,
          chargedAt: Math.floor(Date.now() / 1000),
        };

        const payload = {
          success,
          message: success
            ? "Charge processed"
            : response?.status_msg || response?.message || "Charge failed",
          chargeSnapshot,
          paymentMethod: {
            id: selectedMethod.id,
            instrumentToken: selectedMethod.instrument_token,
            label: selectedMethod.instrument_alias || null,
            last4: selectedMethod.card_last_four,
          },
          gatewayResponse: response,
        };

        return success
          ? NextResponse.json(payload)
          : NextResponse.json(payload, { status: 400 });
      } catch (error) {
        await query(
          `UPDATE payments SET status = 'failed' WHERE pf_token = ? AND location_id = ?`,
          [basketId, locationId],
        );

        return NextResponse.json(
          {
            success: false,
            message: error instanceof Error ? error.message : "Charge failed",
          },
          { status: 400 },
        );
      }
    }

    case "create_subscription": {
      // Require apiKey for subscription creation
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "create_subscription",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      if (!locationId || !amount) {
        return NextResponse.json(
          { error: "locationId and amount required" },
          { status: 400 },
        );
      }

      const { selectedMethod } = await resolveSavedMethod();
      if (!selectedMethod?.instrument_token) {
        return NextResponse.json(
          { error: "Saved payment method not found" },
          { status: 404 },
        );
      }

      const frequency = String(
        body.frequency || body.interval || body.billingCycle || "monthly",
      );
      const months = monthCountForFrequency(frequency);
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + months);

      const subscriptionEmail = email || `${locationId}@crm.local`;
      const subscriptionLabel = description || "Subscription";

      await query(
        `INSERT INTO subscriptions
          (location_id, contact_id, pf_token, payer_email, amount, frequency, status, next_billing)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
         ON DUPLICATE KEY UPDATE
           contact_id = VALUES(contact_id),
           payer_email = VALUES(payer_email),
           amount = VALUES(amount),
           frequency = VALUES(frequency),
           status = 'active',
           next_billing = VALUES(next_billing)`,
        [
          locationId,
          contactId || null,
          selectedMethod.instrument_token,
          subscriptionEmail,
          Number(amount),
          frequency === "quarterly" || frequency === "4"
            ? "quarterly"
            : frequency === "annual" || frequency === "6"
              ? "annual"
              : "monthly",
          nextBilling,
        ],
      );

      await query(
        `INSERT INTO location_subscriptions
          (location_id, status, current_period_start, current_period_end, gopayfast_token, amount, cancel_at)
         VALUES (?, 'active', NOW(), ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE
           status = 'active',
           current_period_start = VALUES(current_period_start),
           current_period_end = VALUES(current_period_end),
           gopayfast_token = VALUES(gopayfast_token),
           amount = VALUES(amount),
           cancel_at = NULL`,
        [
          locationId,
          nextBilling,
          selectedMethod.instrument_token,
          Number(amount),
        ],
      );

      const createdSubSnapshot = {
        id: subscriptionId || selectedMethod.instrument_token,
        status: "active",
        createdAt: Math.floor(Date.now() / 1000),
        trialEnd: 0,
        nextCharge: toEpoch(nextBilling),
        label: subscriptionLabel,
      };

      // Notify GHL that the subscription is now active (spec §5.3 lifecycle events).
      // Fire-and-forget: we don't block the response on this.
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          ghlTransactionId: subscriptionId || selectedMethod.instrument_token,
          chargeId: subscriptionId || selectedMethod.instrument_token,
          subscriptionId: subscriptionId || selectedMethod.instrument_token,
          amount,
          contactId: contactId || null,
          periodEnd: nextBilling.toISOString(),
          eventType: "subscription.active",
        }),
      }).catch((e) => console.warn("[create_subscription → notify]", e));

      return NextResponse.json({
        success: true,
        failed: false,
        message: "Subscription created",
        // Nested shape expected by HighLevel (Create Subscription spec 9.4.2)
        subscription: {
          subscriptionId: subscriptionId || selectedMethod.instrument_token,
          subscriptionSnapshot: createdSubSnapshot,
        },
        // Top-level kept for backward compatibility
        subscriptionSnapshot: createdSubSnapshot,
      });
    }

    case "cancel_subscription": {
      // Require apiKey for subscription cancellation
      {
        const gha = await import("@/lib/ghl-auth");
        const ok = await gha.validateProviderApiKey(
          locationId,
          request,
          "cancel_subscription",
          body,
        );
        if (!ok)
          return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      if (!locationId) {
        return NextResponse.json(
          { error: "locationId required" },
          { status: 400 },
        );
      }

      // ── Whop subscription cancellation (provider-aware) ──
      // Whop runs the recurring billing, so cancelling means cancelling the
      // Whop membership captured on the subscription payment row.
      const whopSubRows = await query<any[]>(
        `SELECT * FROM payments
           WHERE location_id = ? AND provider = 'whop' AND payment_type = 'subscription'
             AND whop_membership_id IS NOT NULL
             AND (custom_str3 = ? OR pf_token = ? OR whop_membership_id = ? OR ? = '')
           ORDER BY id DESC LIMIT 1`,
        [
          locationId,
          subscriptionId || "",
          subscriptionId || "",
          subscriptionId || "",
          subscriptionId || "",
        ],
      );
      const whopSub = whopSubRows[0] || null;
      if (whopSub?.whop_membership_id) {
        const whopInstRows = await query<any[]>(
          `SELECT * FROM installations WHERE location_id = ? LIMIT 1`,
          [locationId],
        );
        const whopApiKey = whopInstRows[0]?.whop_api_key || "";
        const { cancelWhopMembership } = await import("@/lib/whop");
        const cancelRes = await cancelWhopMembership({
          apiKey: whopApiKey,
          membershipId: whopSub.whop_membership_id,
          atPeriodEnd: false,
        });

        if (!cancelRes.ok) {
          return NextResponse.json(
            {
              success: false,
              failed: true,
              message:
                cancelRes.error ||
                "Whop subscription could not be cancelled. You can also cancel it from your Whop dashboard.",
            },
            { status: 400 },
          );
        }

        await query(`UPDATE payments SET status = 'cancelled' WHERE id = ?`, [
          whopSub.id,
        ]);

        return NextResponse.json({
          // Top-level status expected by HighLevel (Cancel Subscription spec 9.4.3)
          status: "canceled",
          success: true,
          message: "Subscription cancelled",
          subscription: {
            subscriptionId: subscriptionId || whopSub.whop_membership_id,
            subscriptionSnapshot: {
              id: subscriptionId || whopSub.whop_membership_id,
              status: "canceled",
              createdAt: toEpoch(whopSub.created_at),
              trialEnd: 0,
              nextCharge: 0,
            },
          },
        });
      }

      const targetRows = subscriptionId
        ? await query<any[]>(
            `SELECT * FROM subscriptions WHERE location_id = ? AND (CAST(id AS CHAR) = ? OR pf_token = ?) ORDER BY id DESC LIMIT 1`,
            [locationId, subscriptionId, subscriptionId],
          )
        : await query<any[]>(
            `SELECT * FROM subscriptions WHERE location_id = ? ORDER BY id DESC LIMIT 1`,
            [locationId],
          );

      const target = targetRows[0] || null;

      if (!target) {
        return NextResponse.json(
          { error: "Subscription not found" },
          { status: 404 },
        );
      }

      await query(
        `UPDATE subscriptions SET status = 'cancelled' WHERE id = ? AND location_id = ?`,
        [target.id, locationId],
      );

      await query(
        `UPDATE location_subscriptions SET status = 'cancelled', cancel_at = NOW() WHERE location_id = ?`,
        [locationId],
      );

      return NextResponse.json({
        // Top-level status expected by HighLevel (Cancel Subscription spec 9.4.3)
        status: "canceled",
        success: true,
        message: "Subscription cancelled",
        subscription: {
          subscriptionId: target.id || subscriptionId || null,
          subscriptionSnapshot: {
            id: target.id || subscriptionId || null,
            status: "canceled",
            createdAt: toEpoch(target?.created_at),
            trialEnd: 0,
            nextCharge: 0,
          },
        },
      });
    }

    // ── Default ──────────────────────────────────────────────
    default:
      return NextResponse.json(
        { error: "Unknown query type" },
        { status: 400 },
      );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "ok",
    provider: "GoPayFast by 10x Digital Ventures",
  });
}
