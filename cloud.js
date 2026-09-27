/*
MileCount Cloud V2 — Supabase Auth + user cloud data
Publishable key is intentionally browser-safe. RLS protects user rows.
*/
const MILECOUNT_SUPABASE_URL = "https://lrnvxqtmywkhtrmsjquc.supabase.co";
const MILECOUNT_SUPABASE_KEY = "sb_publishable_6cP65DrMPJFkHgnk6eEAAA_-LQQC1fN";

window.MileCountCloud = (() => {
  let client = null;

  function init() {
    if (!window.supabase) throw new Error("Supabase client library unavailable.");
    if (!client) client = window.supabase.createClient(MILECOUNT_SUPABASE_URL, MILECOUNT_SUPABASE_KEY);
    return client;
  }

  async function signUp(email,password,displayName="") {
    const {data,error}=await init().auth.signUp({email,password,options:{data:{display_name:displayName}}});
    if(error) throw error; return data;
  }
  async function signIn(email,password) {
    const {data,error}=await init().auth.signInWithPassword({email,password});
    if(error) throw error; return data;
  }
  async function signOut(){const {error}=await init().auth.signOut();if(error)throw error}
  async function session(){const {data,error}=await init().auth.getSession();if(error)throw error;return data.session}
  async function profile(){const s=await session();if(!s)return null;const {data,error}=await init().from("profiles").select("*").eq("id",s.user.id).single();if(error)throw error;return data}
  async function vehicles(){const {data,error}=await init().from("vehicles").select("*").order("created_at",{ascending:false});if(error)throw error;return data}
  async function saveVehicle(v){const s=await session();if(!s)throw new Error("Sign in first.");const row={...v,user_id:s.user.id};const {data,error}=await init().from("vehicles").insert(row).select().single();if(error)throw error;return data}
  async function trips(){const {data,error}=await init().from("trips").select("*").order("created_at",{ascending:false});if(error)throw error;return data}
  async function saveTrip(t){const s=await session();if(!s)throw new Error("Sign in first.");const {data,error}=await init().from("trips").insert({...t,user_id:s.user.id}).select().single();if(error)throw error;return data}
  function onAuthChange(fn){return init().auth.onAuthStateChange((_event,session)=>fn(session))}
  return {isEnabled:()=>true,init,signUp,signIn,signOut,session,profile,vehicles,saveVehicle,trips,saveTrip,onAuthChange};
})();