// TrukTek -> MileCount adapter
// IMPORTANT: Do not enable commercial ingestion until MileCount has written authorization
// or an agreement permitting this use. TrukTek's public endpoint is not treated as permission
// to bulk-download, redistribute, or commercially ingest its load data.
export function normalizeTrukTek(load){
  return {
    provider_load_id:String(load.loadId||""),
    pickup_city:[load.octy,load.ost].filter(Boolean).join(", "),
    delivery_city:[load.dcty,load.dst].filter(Boolean).join(", "),
    pickup_start:load.pickupDate||null,
    delivery_start:load.deliveryDate||null,
    pay:Number(load.ratePay||0),
    weight_lb:Number(load.weight||0),
    length_ft:Number(load.length||0),
    vehicle_types:mapEquipment(load.equip),
    booking_reference:String(load.loadId||""),
    raw_provider:{equipment:load.equip,distance:load.loadDist,gross_rpm:load.grossRpm}
  };
}
function mapEquipment(e){
 const x=String(e||"").toLowerCase();
 if(x==="van") return ["cargo","sprinter","box16","box20","box24","box26"];
 return [];
}
