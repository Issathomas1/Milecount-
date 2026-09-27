// LoadBoot -> MileCount adapter scaffold.
// Activate only after LoadBoot supplies authorized read/sandbox credentials and confirms fields.
export function normalizeLoadBoot(load){
 return {
  provider_load_id:String(load.id||load.reference||""),
  pickup_city:String(load.origin||""),
  delivery_city:String(load.destination||""),
  pickup_start:load.pickup_date||null,
  pay:Number(load.rate||0),
  weight_lb:Number(load.weight||0),
  length_ft:Number(load.length_ft||0),
  vehicle_types:mapEquipment(load.equipment),
  booking_reference:String(load.id||load.reference||"")
 };
}
function mapEquipment(e){
 const x=String(e||"").toLowerCase();
 if(x.includes("box"))return ["box16","box20","box24","box26"];
 if(x.includes("sprinter"))return ["sprinter"];
 if(x.includes("cargo"))return ["cargo"];
 if(x.includes("van"))return ["cargo","sprinter","box16","box20","box24","box26"];
 return [];
}
