import {query} from './db';
import {getValidWhopGhlToken} from './whop-ghl-token';
const WEBHOOK='https://backend.leadconnectorhq.com/payments/custom-provider/webhook';
export async function sendWhopGhlNotification(input:{locationId:string;ghlTransactionId:string;chargeId:string;amount:number;contactId?:string|null;invoiceId?:string|null;orderId?:string|null;subscriptionId?:string|null;eventType?:string}){
 const rows=await query<any[]>('SELECT provider_api_key FROM whop_ghl_installations WHERE location_id=? LIMIT 1',[input.locationId]);const apiKey=String(rows[0]?.provider_api_key||'');if(!apiKey)return{ok:false,status:400,error:'Whop provider key missing'};
 const token=await getValidWhopGhlToken(input.locationId);if(!token)return{ok:false,status:401,error:'Whop GHL token unavailable'};const now=Math.floor(Date.now()/1000);const event=input.eventType||'payment.captured';
 const payload:Record<string,unknown>={event,chargeId:input.chargeId,ghlTransactionId:input.ghlTransactionId,locationId:input.locationId,apiKey,chargeSnapshot:{id:input.chargeId,status:'succeeded',amount:Number(input.amount),chargeId:input.chargeId,chargedAt:now}};
 if(process.env.WHOP_GHL_MARKETPLACE_APP_ID)payload.marketplaceAppId=process.env.WHOP_GHL_MARKETPLACE_APP_ID;if(input.contactId)payload.contactId=input.contactId;if(input.invoiceId)payload.invoiceId=input.invoiceId;if(input.orderId)payload.orderId=input.orderId;if(input.subscriptionId)payload.ghlSubscriptionId=input.subscriptionId;
 const response=await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});const text=await response.text();return response.ok?{ok:true,status:response.status}:{ok:false,status:response.status,error:text};
}
