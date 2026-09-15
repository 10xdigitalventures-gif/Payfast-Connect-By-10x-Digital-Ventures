import { NextRequest,NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { provisionWhopProvider } from '@/lib/whop-ghl-provider';

function location(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&!value.includes('{');}
export async function GET(request:NextRequest){
  const locationId=request.nextUrl.searchParams.get('locationId'); if(!location(locationId))return NextResponse.json({installed:false});
  const rows=await query<any[]>(`SELECT whop_api_key,whop_company_id,whop_webhook_secret,whop_rate_mode,whop_exchange_rate,
    whop_fee_percent,whop_currency,access_token IS NOT NULL AS oauth_connected FROM whop_ghl_installations WHERE location_id=? LIMIT 1`,[locationId]);
  if(!rows.length)return NextResponse.json({installed:false,oauth_connected:false}); const row=rows[0];
  return NextResponse.json({installed:true,oauth_connected:!!row.oauth_connected,whop_api_key:row.whop_api_key||'',whop_company_id:row.whop_company_id||'',
    whop_webhook_secret:row.whop_webhook_secret||'',whop_rate_mode:row.whop_rate_mode||'fixed',whop_exchange_rate:String(row.whop_exchange_rate||280),
    whop_fee_percent:String(row.whop_fee_percent??10),whop_currency:row.whop_currency==='USD'?'USD':'PKR'});
}
export async function POST(request:NextRequest){
  const body=await request.json(); const locationId=body.locationId; if(!location(locationId))return NextResponse.json({error:'Valid location required'},{status:400});
  if(!String(body.whop_api_key||'').trim()||!String(body.whop_company_id||'').trim())return NextResponse.json({error:'Whop API key and Company ID are required'},{status:400});
  const rows=await query<any[]>('SELECT access_token FROM whop_ghl_installations WHERE location_id=? LIMIT 1',[locationId]);
  if(!rows[0]?.access_token)return NextResponse.json({error:'Install the standalone Whop GHL app first.'},{status:409});
  const rate=Number(body.whop_exchange_rate); const fee=Number(body.whop_fee_percent);
  await query(`UPDATE whop_ghl_installations SET whop_api_key=?,whop_company_id=?,whop_webhook_secret=?,whop_rate_mode=?,
    whop_exchange_rate=?,whop_fee_percent=?,whop_currency=?,updated_at=NOW() WHERE location_id=?`,[
      String(body.whop_api_key).trim(),String(body.whop_company_id).trim(),body.whop_webhook_secret||null,body.whop_rate_mode==='live'?'live':'fixed',
      Number.isFinite(rate)&&rate>0?rate:280,Number.isFinite(fee)&&fee>=0?fee:10,body.whop_currency==='USD'?'USD':'PKR',locationId]);
  const provisioned=await provisionWhopProvider(locationId);
  if(!provisioned.ok)return NextResponse.json({success:false,saved:true,error:'Settings saved but provider registration failed',detail:provisioned},{status:502});
  return NextResponse.json({success:true,provider:'whop'});
}
