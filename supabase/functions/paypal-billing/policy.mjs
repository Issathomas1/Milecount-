// Pure policy shared by the Edge Function and regression tests.
export const BASIC = Object.freeze({key:'basic',name:'Basic',amount:'19.00',currency:'USD',livePlanId:'P-69L05151FD3776706NK74IGI'});
export function validatePlan(plan, expected=BASIC) {
 const cycles=plan?.billing_cycles;
 if(plan?.status!=='ACTIVE' || !Array.isArray(cycles) || cycles.length!==1) throw Error('PayPal plan is not ready');
 const c=cycles[0],price=c.pricing_scheme?.fixed_price;
 if(c.tenure_type!=='REGULAR'||c.frequency?.interval_unit!=='MONTH'||c.frequency?.interval_count!==1||c.total_cycles!==0||price?.currency_code!==expected.currency||Number(price?.value)!==Number(expected.amount)||Number(plan.payment_preferences?.setup_fee?.value||0)!==0||plan.quantity_supported) throw Error('PayPal price or billing terms do not match MileCount');
 // Tax configuration needs its own reviewed disclosure before it can be sold.
 if(Number(plan.taxes?.percentage||0)!==0) throw Error('Review tax disclosure before enabling checkout');
 return true;
}
export function nextMonth(value) {
 const d=new Date(value),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));return d.getTime();
}
export function paidSnapshot(subscription,transactions,checkout,now=Date.now()) {
 if(subscription.id!==checkout.subscription_id||subscription.plan_id!==checkout.plan_id||subscription.custom_id!==checkout.id||subscription.plan_overridden||Number(subscription.quantity||1)!==1) throw Error('Subscription does not match this checkout');
 if(!['APPROVAL_PENDING','APPROVED','ACTIVE','SUSPENDED','CANCELLED','EXPIRED'].includes(subscription.status)) throw Error('Unrecognized subscription state');
 const result={status:subscription.status,paymentId:null,paidUntil:null};
 if(!['ACTIVE','SUSPENDED','CANCELLED','EXPIRED'].includes(subscription.status)) return result;
 const last=subscription.billing_info?.last_payment;
 const lastTime=Date.parse(last?.time);
 if(!Number.isFinite(lastTime)||lastTime>now||last?.amount?.currency_code!=='USD'||Number(last?.amount?.value)!==19) return result;
 // Require a settled transaction as well as ACTIVE/last_payment. Approval is not payment.
 const matches=transactions.filter(t=>Math.abs(Date.parse(t.time)-lastTime)<60000);
 const payment=matches.find(t=>t.status==='COMPLETED'&&t.amount_with_breakdown?.gross_amount?.currency_code==='USD'&&Number(t.amount_with_breakdown?.gross_amount?.value)===19);
 if(!payment?.id || matches.some(t=>['REFUNDED','PARTIALLY_REFUNDED','REVERSED'].includes(t.status))) return result;
 let end=nextMonth(lastTime);
 const next=Date.parse(subscription.billing_info?.next_billing_time);
 if(Number.isFinite(next)) end=Math.min(end,next);
 result.paymentId=payment.id;
 if(end>now)result.paidUntil=new Date(end).toISOString();
 return result;
}
export function approvalLink(subscription,environment) {
 const href=subscription.links?.find(l=>l.rel==='approve')?.href;
 if(!href)return null;
 const u=new URL(href),host=environment==='live'?'www.paypal.com':'www.sandbox.paypal.com';
 if(u.protocol!=='https:'||u.hostname!==host)throw Error('Unexpected PayPal approval address');
 return u.href;
}
