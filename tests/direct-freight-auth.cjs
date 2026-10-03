// Execute the real Edge Function handler against the provider's published
// request/response contract, not a mock of MileCount's connect endpoint.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const contract=require('./fixtures/direct-freight-auth-contract.json');
const source=fs.readFileSync('supabase/functions/directfreight-adapter/index.ts','utf8').replace(/^import .*;\n/gm,'');
function harness(){
 const calls=[],connections=new Map();let handler,providerReply,providerStatus=201,dbError=false;
 const ctx={Request,Response,JSON,Date,console,Deno:{env:{get:key=>({DIRECT_FREIGHT_API_TOKEN:'fixture-partner',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_URL:'https://fixture-db'})[key]},serve:h=>handler=h},
  createClient:()=>({auth:{getUser:async token=>token.startsWith('session-')?{data:{user:{id:token.slice(8)}},error:null}:{data:{user:null},error:'invalid'}},from:table=>{
   assert.equal(table,'provider_connections');const filters={};let fields='',deleting=false;
   const query={select:s=>(fields=s,query),delete:()=>(deleting=true,query),eq:(k,v)=>(filters[k]=v,query),maybeSingle:async()=>{
    assert(filters.user_id);assert.equal(filters.provider,'direct_freight');const data=connections.get(filters.user_id);
    return {data:data?Object.fromEntries(fields.split(',').map(k=>[k,data[k]])):null,error:null};
   },upsert:async row=>{if(dbError)return {error:Error('fixture write rejected')};connections.set(row.user_id,row);return {error:null};},then:resolve=>{assert(deleting);assert(filters.user_id);connections.delete(filters.user_id);resolve({error:null});}};
   return query;
  }}),fetch:async(url,options)=>{
   const body=JSON.parse(options.body);calls.push({url,headers:options.headers,body});
   if(url.endsWith('/end_user_authentications')){
    assert.deepEqual(Object.keys(body).sort(),contract.loginRequest.required.slice().sort());
    assert(contract.loginRequest.properties.realm.enum.includes(body.realm));
    assert.equal(options.headers['api-token'],'fixture-partner');
    return new Response(JSON.stringify(providerReply??{'end-user-token':'fixture-user-'+body.login}),{status:providerStatus});
   }
   assert(url.endsWith('/boards/loads'));return new Response(JSON.stringify({loads:[{entry_id:1,origin_city:'Atlanta',origin_state:'GA',destination_city:'Charlotte',destination_state:'NC'}]}));
  }};
 vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),ctx);
 return {calls,connections,setProvider:(body,status=201)=>{providerReply=body;providerStatus=status;},failDB:()=>dbError=true,request:async(body,session='session-A')=>{const response=await handler(new Request('https://fixture',{method:'POST',headers:{Authorization:'Bearer '+session},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}};
}
(async()=>{
 const h=harness(),login={action:'connect',email:'driver@example.invalid',password:'fixture-user-password'};
 assert.equal((await h.request(login,'invalid')).status,401);assert.equal(h.calls.length,0);
 const connected=await h.request(login);assert.equal(connected.status,200);assert(connected.body.connected);
 assert.equal(h.calls[0].body.login,login.email);assert.equal(h.calls[0].body.realm,'email');assert.equal(h.calls[0].body.secret,login.password);
 assert.equal(h.connections.get('A').access_token,'fixture-user-'+login.email);
 assert(!JSON.stringify([...h.connections.values()]).includes(login.password));
 assert(!JSON.stringify(connected.body).includes('fixture-user-'));
 assert(!(await h.request({action:'status'},'session-B')).body.connected);
 assert.equal((await h.request({action:'search',origin:'Atlanta, GA'},'session-B')).status,401);
 await h.request({action:'search',origin:'Atlanta, GA'});assert.equal(h.calls.at(-1).headers['end-user-token'],'fixture-user-'+login.email);
 assert.equal(h.calls.at(-1).headers['api-token'],'fixture-partner');
 assert.equal(h.calls.at(-1).body.destination_state,undefined,'Normal outbound discovery stays unrestricted');
 await h.request({action:'search',origin:'Atlanta, GA',local_state:'GA',page:0});
 assert.deepEqual(h.calls.at(-1).body.origin_state,['GA']);assert.deepEqual(h.calls.at(-1).body.destination_state,['GA']);
 await h.request({action:'search',origin:'Atlanta, GA',local_state:'GA',page:1});
 assert.deepEqual(h.calls.at(-1).body.destination_state,['GA']);assert.equal(h.calls.at(-1).body.page_number,1);
 assert.equal((await h.request({action:'search',origin:'Atlanta, GA',local_state:'FL'})).status,400);
 assert.equal((await h.request({action:'search',origin:'33.7,-84.3',local_state:'GA'})).status,400);
 await h.request({...login,email:'second@example.invalid'},'session-B');
 await h.request({action:'disconnect'});assert(!h.connections.has('A'));assert(h.connections.has('B'));
 const bad=harness();bad.setProvider({error:'Invalid credentials'},422);assert.equal((await bad.request(login)).status,400);assert.equal(bad.connections.size,0);
 const wrongToken=harness();wrongToken.setProvider({api_token:'fixture-partner'});assert.equal((await wrongToken.request(login)).status,502);assert.equal(wrongToken.connections.size,0);
 const database=harness();database.failDB();assert.equal((await database.request(login)).body.ok,false);
 assert('end-user-token' in contract.loginResponse.properties);
 console.log('PASS documented Direct Freight login/realm/secret request and hyphenated user token; tenant isolation; no password/token leak; rejected login, wrong token, failed save');
})().catch(error=>{console.error(error);process.exit(1)});
