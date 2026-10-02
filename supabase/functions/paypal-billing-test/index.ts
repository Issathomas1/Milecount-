import {createHandler} from '../paypal-billing/handler.mjs';
import {billingEnvironment} from '../paypal-billing/environment.mjs';
Deno.serve(createHandler({env:billingEnvironment((name:string)=>Deno.env.get(name),'sandbox')}));
