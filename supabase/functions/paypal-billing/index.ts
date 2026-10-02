import {createHandler} from './handler.mjs';
import {billingEnvironment} from './environment.mjs';
Deno.serve(createHandler({env:billingEnvironment((name:string)=>Deno.env.get(name),'live')}));
