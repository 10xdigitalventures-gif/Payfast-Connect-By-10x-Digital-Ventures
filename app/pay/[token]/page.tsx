import { notFound } from 'next/navigation';
import { resolvePublicPaySource } from '@/lib/public-pay';
import PaymentPageClient from './PaymentPageClient';

export default async function PublicPayPage({ params }:{ params: Promise<{ token:string }> }) {
  const { token } = await params;

  const resolved = await resolvePublicPaySource(token);
  if (!resolved) notFound();
  const source = resolved.data;

  // Check expiry / max uses for payment links
  if (resolved.kind === 'payment_link') {
    const link = source;
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return <ExpiredPage message="This payment link has expired." />;
    }
    if (link.max_uses > 0 && link.uses_count >= link.max_uses) {
      return <ExpiredPage message="This payment link has reached its maximum number of uses." />;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Determine amount and item info
  const isCustomAmount = source.amount_type === 'custom';
  const amount  = source.amount || source.total || '0';
  const name    = source.name || source.title || `Payment Request`;
  const desc    = source.description || source.notes || '';
  const isRecurring = source.type === 'subscription';

  return (
    <PaymentPageClient
      token={token}
      name={name}
      description={desc}
      amount={String(amount)}
      isCustomAmount={isCustomAmount}
      isRecurring={isRecurring}
      interval={source.interval || 'monthly'}
      collectPhone={!!source.collect_phone}
      collectAddress={!!source.collect_address}
      allowCoupon={source.allow_coupon !== 0}
      locationId={source.location_id}
      prefilledEmail={source.payer_email || source.client_email || ''}
      prefilledName={source.contact_name || source.client_name || ''}
      prefilledPhone={source.phone || source.client_phone || ''}
      merchantId={source.merchant_id}
      merchantKey={source.merchant_key}
      passphrase={source.passphrase}
      environment={source.environment}
      appUrl={appUrl}
    />
  );
}

function ExpiredPage({ message }:{ message:string }) {
  return (
    <div style={{ minHeight:'100vh', background:'#050A1A', display:'grid', placeItems:'center', fontFamily:'DM Sans, sans-serif', color:'white', padding:24 }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⏰</div>
        <h2 style={{ fontFamily:'var(--font-head)', fontSize:24, marginBottom:8 }}>Link Unavailable</h2>
        <p style={{ color:'#8A9BC0' }}>{message}</p>
      </div>
    </div>
  );
}
