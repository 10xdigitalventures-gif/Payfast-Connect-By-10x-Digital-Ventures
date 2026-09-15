import crypto from 'crypto';
import { query } from './db';
import { getValidWhopGhlToken } from './whop-ghl-token';

const GHL_API='https://services.leadconnectorhq.com';
const VERSION='2021-07-28';
function appUrl(path:string){return `${(process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'')}${path}`;}
async function request(path:string,token:string,method:'POST'|'PUT',body:unknown){
  const response=await fetch(`${GHL_API}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Version:VERSION,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const text=await response.text(); if(!response.ok) throw new Error(`${response.status} ${text}`); return text?JSON.parse(text):null;
}
async function keys(locationId:string){
  const rows=await query<any[]>('SELECT provider_api_key,provider_publishable_key FROM whop_ghl_installations WHERE location_id=? LIMIT 1',[locationId]);
  const apiKey=rows[0]?.provider_api_key||`sk_${crypto.randomBytes(24).toString('hex')}`;
  const publishableKey=rows[0]?.provider_publishable_key||`pk_${crypto.randomBytes(16).toString('hex')}`;
  await query('UPDATE whop_ghl_installations SET provider_api_key=?,provider_publishable_key=? WHERE location_id=?',[apiKey,publishableKey,locationId]);
  return {apiKey,publishableKey};
}
export async function provisionWhopProvider(locationId:string){
  const token=await getValidWhopGhlToken(locationId); if(!token)return {ok:false,reason:'missing_whop_app_token' as const};
  try{
    const provider=await request(`/payments/custom-provider/provider?${new URLSearchParams({locationId})}`,token,'POST',{
      name:'10x Whop App',description:'Dedicated Whop payment and subscription provider',locationId,
      paymentsUrl:appUrl('/apps/whop/checkout'),queryUrl:`${appUrl('/api/apps/whop/query')}?locationId=${encodeURIComponent(locationId)}`,
      imageUrl:process.env.WHOP_GHL_PROVIDER_LOGO_URL||appUrl('/logo.png'),supportsSubscriptionSchedule:true});
    const providerKeys=await keys(locationId); const config={apiKey:providerKeys.apiKey,publishableKey:providerKeys.publishableKey};
    const connection=await request(`/payments/custom-provider/connect?${new URLSearchParams({locationId})}`,token,'POST',{live:config,test:config});
    const capabilities=await request('/payments/custom-provider/capabilities',token,'PUT',{supportsSubscriptionSchedules:true,locationId});
    return {ok:true,provider,connection,capabilities};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
}
