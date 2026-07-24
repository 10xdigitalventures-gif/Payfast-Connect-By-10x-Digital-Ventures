import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /checkout/success?location_id=...&basket_id=...
// Whop redirects here after payment. Fires postMessage to the GHL iframe,
// then auto-closes. Also fast-paths the pending payment to complete so the
// CRM sees it immediately even if the Whop webhook is delayed.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locationId = params.get('location_id') || '';
  const basketId   = params.get('basket_id')   || '';

  if (basketId && locationId) {
    await query(
      `UPDATE payments
         SET status = 'complete', updated_at = NOW()
         WHERE pf_token = ? AND location_id = ? AND status = 'pending'`,
      [basketId, locationId]
    ).catch(() => {});
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Payment Successful</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#0f172a;display:grid;place-items:center;
         font-family:'DM Sans',system-ui,sans-serif;color:#f1f5f9}
    .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
          padding:40px 48px;text-align:center;max-width:420px;width:90%}
    .icon{font-size:56px;line-height:1;margin-bottom:20px}
    h2{font-size:22px;font-weight:700;margin-bottom:10px;color:#22c55e}
    p{font-size:14px;color:#94a3b8;line-height:1.6}
    .note{margin-top:24px;font-size:12px;color:#64748b}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h2>Payment Successful!</h2>
    <p>Your payment has been received.<br/>This window will close shortly.</p>
    <div class="note" id="note">Notifying your dashboard&hellip;</div>
  </div>
  <script>
    (function(){
      var bid='${basketId}';
      try{window.parent.postMessage({type:'payment-success',basketId:bid},'*');}catch(e){}
      try{window.parent.postMessage({type:'custom_element_success_response',chargeId:bid},'*');}catch(e){}
      setTimeout(function(){
        try{window.close();}catch(e){}
        document.getElementById('note').textContent='You may close this window.';
      },3000);
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
