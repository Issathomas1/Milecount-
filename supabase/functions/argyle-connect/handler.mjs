// Server-only Argyle adapter. No driver passwords, API secrets, or raw gig
// payloads are stored by MileCount. All ownership comes from verified Auth.
const PROVIDERS = { instacart: 'Instacart', spark: 'Spark Driver' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEM = /^item_[A-Za-z0-9_-]+$/;
class Fault extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function parseObject(value) { try { return JSON.parse(value || '{}'); } catch { return {}; } }
function number(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value); return Number.isFinite(n) ? n : null;
}
function iso(value) { const n = Date.parse(value); return Number.isFinite(n) ? new Date(n).toISOString() : null; }
export function summarizeGigs(gigs, accountIds, since, until) {
  const seen = new Set(), records = [], totals = new Map();
  for (const gig of gigs) {
    const start = iso(gig.start_datetime);
    if (!gig.id || seen.has(gig.id) || !accountIds.has(gig.account) || gig.type !== 'delivery' ||
        gig.status !== 'completed' || gig.earning_type !== 'work' || !start || start < since || start > until) continue;
    seen.add(gig.id);
    const currency = /^[A-Z]{3}$/.test(gig.income?.currency || '') ? gig.income.currency : null;
    const pay = currency ? number(gig.income?.total) : null;
    const distance = number(gig.distance), seconds = number(gig.duration);
    const miles = distance !== null && distance >= 0 ? (gig.distance_unit === 'miles' ? distance : gig.distance_unit === 'km' ? distance / 1.609344 : null) : null;
    const row = { id: gig.id, accountId: gig.account, start, pay, currency, miles,
      minutes: seconds !== null && seconds >= 0 ? seconds / 60 : null };
    records.push(row);
    const key = currency || 'unknown';
    const group = totals.get(key) || { currency, earnings: 0, paidRecords: 0, completed: 0, missingPay: 0 };
    group.completed++; if (pay === null) group.missingPay++; else { group.earnings += pay; group.paidRecords++; }
    totals.set(key, group);
  }
  return { totals: [...totals.values()].map(t => ({ ...t, earnings: Math.round(t.earnings * 100) / 100 })),
    completed: records.length, records: records.sort((a,b) => b.start.localeCompare(a.start)).slice(0,50) };
}
export function createHandler({ env, fetchImpl = fetch, now = () => Date.now() }) {
  const mode = env('ARGYLE_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
  const base = mode === 'production' ? 'https://api.argyle.com/v2' : 'https://api-sandbox.argyle.com/v2';
  const id = env('ARGYLE_API_KEY_ID'), secret = env('ARGYLE_API_KEY_SECRET');
  const items = parseObject(env('ARGYLE_ITEMS_JSON'));
  const providers = Object.entries(PROVIDERS).map(([key,name]) => ({ key, name, available: ITEM.test(items[key] || '') }));
  // A reviewed Link flow must restrict data collection to gig activity and must
  // disable deposit switching, identity documents and unrelated payroll data.
  const flowId = env('ARGYLE_FLOW_ID');
  const ready = !!id && !!secret && !!flowId && providers.some(p => p.available) &&
    (mode !== 'production' || env('ARGYLE_PRODUCTION_ENABLED') === 'true');
  const supabase = env('SUPABASE_URL');
  const serverKey = parseObject(env('SUPABASE_SECRET_KEYS')).default || env('SUPABASE_SERVICE_ROLE_KEY');
  const origins = new Set(['https://milecount.editallfutures.com','https://milecount.pages.dev','https://mymilecount.com','https://www.mymilecount.com',
    ...(env('ARGYLE_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)]);
  const configuration = () => ({ configured: ready, environment: mode, liveOffers: false,
    providers: providers.map(p => ({ ...p, available: ready && p.available })),
    message: ready ? (mode === 'sandbox' ? 'Test connections only. Use Argyle sample accounts, not your driver login.' : 'Connect to share earnings and completed delivery activity.') : 'Account connections are awaiting activation. Your saved offers and planner still work.' });
  async function request(url, options = {}) {
    try { return await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(8000) }); }
    catch { throw new Fault(502, 'provider_unavailable', 'Connection service could not be reached. Please retry.'); }
  }
  async function argyle(path, method = 'GET', body) {
    const response = await request(base + path, { method, headers: { Authorization: 'Basic ' + btoa(id + ':' + secret), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Fault(response.status === 429 ? 429 : 502, 'provider_rejected', response.status === 429 ? 'Connection service is busy. Please wait before retrying.' : 'Argyle could not complete this request. Please retry or contact MileCount.');
    if (response.status === 204) return {};
    const data = await response.json().catch(() => null);
    if (!data) throw new Fault(502, 'invalid_provider_response', 'Connection service returned an incomplete response.');
    return data;
  }
  async function list(path, filters, maxPages = 5) {
    let cursor = null; const results = [];
    for (let page = 0; page < maxPages; page++) {
      const q = new URLSearchParams({ ...filters, limit: '200' }); if (cursor) q.set('cursor', cursor);
      const data = await argyle(path + '?' + q);
      if (!Array.isArray(data.results)) throw new Fault(502, 'invalid_provider_response', 'Connection service returned incomplete records.');
      results.push(...data.results);
      if (!data.next) return { results, partial: false };
      let next; try { next = new URL(data.next); } catch { throw new Fault(502, 'invalid_pagination', 'Connection service returned an invalid page.'); }
      // Never follow an upstream URL with credentials. Copy only its cursor and
      // rebuild the original, owner-scoped query against the fixed API origin.
      if (next.origin !== new URL(base).origin || next.pathname.replace(/\/$/,'') !== '/v2' + path || !next.searchParams.get('cursor'))
        throw new Fault(502, 'invalid_pagination', 'Connection service returned an invalid page.');
      cursor = next.searchParams.get('cursor');
    }
    return { results, partial: true };
  }
  async function db(path, method = 'GET', body, prefer) {
    const response = await request(supabase + '/rest/v1/' + path, { method, headers: { apikey: serverKey, Authorization: 'Bearer ' + serverKey,
      'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Fault(503, 'storage_unavailable', 'Account connections are temporarily unavailable. Please retry.');
    if (response.status === 204) return [];
    return response.json().catch(() => []);
  }
  return async req => {
    const origin = req.headers.get('origin');
    const headers = { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin',
      'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS, GET',
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin':origin } : {}) };
    const out = (data,status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !origins.has(origin)) return out({ ok:false, error:'Origin not allowed.' },403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method === 'GET') return out({ ok:true, ...configuration() }); // Non-personal readiness only.
    if (req.method !== 'POST') return out({ ok:false, error:'Method not allowed.' },405);
    let lock, scope;
    try {
      const token = (req.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) throw new Fault(401,'sign_in_required','Sign in to MileCount to manage connections.');
      const auth = await request(supabase + '/auth/v1/user', { headers:{ apikey:serverKey, Authorization:'Bearer ' + token } });
      if (!auth.ok) throw new Fault(401,'sign_in_required','Your MileCount session expired. Sign in again.');
      const user = await auth.json();
      if (!UUID.test(user.id || '')) throw new Fault(401,'sign_in_required','Sign in to MileCount to manage connections.');
      const raw = await req.text(); if (raw.length > 2048) throw new Fault(413,'invalid_request','Request is too large.');
      let body; try { body = JSON.parse(raw); } catch { throw new Fault(400,'invalid_request','Invalid request.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Fault(400,'invalid_request','Invalid request.');
      const action = body.action || 'status';
      if (!['status','link','activity','disconnect'].includes(action)) throw new Fault(400,'invalid_action','Unknown connection action.');
      if (!ready) return out({ ok:true, ...configuration(), accounts:[], activity:null });
      scope = 'user_id=eq.' + user.id + '&environment=eq.' + mode;
      const mappingPath = 'argyle_user_connections?' + scope;
      let [mapping] = await db(mappingPath + '&select=argyle_user_id');
      if (!mapping && action !== 'link') return out({ ok:true,...configuration(),accounts:[],activity:null });
      if (action === 'link' && (body.consent !== true || !PROVIDERS[body.provider] || !ITEM.test(items[body.provider] || '')))
        throw new Fault(400,'consent_required','Choose an available platform and agree to share delivery activity first.');
      if (!mapping) {
        await db('argyle_user_connections?on_conflict=user_id,environment','POST',{user_id:user.id,environment:mode},'resolution=ignore-duplicates,return=minimal');
      }
      const lockId = crypto.randomUUID();
      const locked = await db(mappingPath + '&or=(locked_until.is.null,locked_until.lt.' + encodeURIComponent(new Date(now()).toISOString()) + ')','PATCH',
        {lock_id:lockId,locked_until:new Date(now()+120000).toISOString()},'return=representation');
      if (!locked.length) throw new Fault(429,'connection_busy','A connection update is already running. Please wait and try again.');
      lock = lockId; mapping = locked[0];
      if (action === 'link' && !mapping.argyle_user_id) {
        const created = await argyle('/users','POST',{});
        if (!UUID.test(created.id || '')) throw new Fault(502,'invalid_provider_response','Unable to initialize your connection.');
        // Save ownership before ever returning a Link token to the browser.
        await db(mappingPath,'PATCH',{argyle_user_id:created.id,consent_version:'2026-10-03',consented_at:new Date(now()).toISOString()},'return=minimal');
        mapping.argyle_user_id = created.id;
      }
      if (!mapping.argyle_user_id) return out({ok:true,...configuration(),accounts:[],activity:null});
      if (action === 'link') {
        const item = await argyle('/items/' + encodeURIComponent(items[body.provider]));
        if (item.id !== items[body.provider] || item.status === 'unavailable' || item.is_grouping === true)
          throw new Fault(409,'platform_unavailable','This platform cannot connect right now. Please try again later.');
        let accountId;
        if (body.accountId) {
          if (!UUID.test(body.accountId)) throw new Fault(400,'invalid_account','Invalid account.');
          const account = await argyle('/accounts/' + body.accountId);
          if (account.user !== mapping.argyle_user_id || account.item !== items[body.provider]) throw new Fault(403,'account_not_owned','This account does not belong to your MileCount login.');
          accountId = account.id;
        }
        await db(mappingPath,'PATCH',{consent_version:'2026-10-03',consented_at:new Date(now()).toISOString()},'return=minimal');
        const result = await argyle('/user-tokens','POST',{user:mapping.argyle_user_id});
        if (typeof result.user_token !== 'string' || !result.user_token) throw new Fault(502,'invalid_provider_response','Unable to open a secure connection.');
        return out({ok:true, ...configuration(),userToken:result.user_token,flowId,items:[items[body.provider]],...(accountId?{accountId}:{})});
      }
      if (action === 'disconnect') {
        if (body.confirm !== true || !UUID.test(body.accountId || '')) throw new Fault(400,'confirmation_required','Confirm the account to disconnect.');
        const account = await argyle('/accounts/' + body.accountId);
        if (account.user !== mapping.argyle_user_id) throw new Fault(403,'account_not_owned','This account does not belong to your MileCount login.');
        await argyle('/accounts/' + body.accountId,'DELETE');
        return out({ok:true,disconnected:true});
      }
      const response = await list('/accounts',{user:mapping.argyle_user_id},2);
      const accounts = response.results.filter(a=>a.user === mapping.argyle_user_id).map(a=>{
        const provider = Object.keys(PROVIDERS).find(k=>items[k]===a.item);
        return {id:a.id,provider:provider||null,name:PROVIDERS[provider]||'Connected work account',status:a.connection?.status||'unknown',
          scannedAt:iso(a.scanned_at),syncStatus:a.availability?.gigs?.status||'unavailable',refreshStatus:a.ongoing_refresh?.status||'unknown',
          needsReconnect:a.connection?.status==='error'||a.connection?.status==='disconnected'};
      });
      let activity = null;
      if (action === 'activity' && accounts.length) {
        const since = new Date(now()-30*86400000).toISOString(), until = new Date(now()).toISOString();
        const gigs = await list('/gigs',{user:mapping.argyle_user_id,from_start_datetime:since,to_start_datetime:until});
        activity = {...summarizeGigs(gigs.results,new Set(accounts.map(a=>a.id)),since,until),since,until,partial:gigs.partial};
      }
      return out({ok:true,...configuration(),accounts,accountsPartial:response.partial,activity,checkedAt:new Date(now()).toISOString()});
    } catch(e) {
      return out({ok:false,code:e instanceof Fault?e.code:'connection_error',error:e instanceof Fault?e.message:'Unable to update connections. Please retry.'},e instanceof Fault?e.status:500);
    } finally {
      if (lock && scope) {
        try { await db('argyle_user_connections?'+scope+'&lock_id=eq.'+lock,'PATCH',{lock_id:null,locked_until:new Date(now()+2000).toISOString()},'return=minimal'); } catch {}
      }
    }
  };
}
