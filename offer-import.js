(function(root){
'use strict';
function parse(text){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const source=/instacart/i.test(text)?'Instacart':/spark|walmart/i.test(text)?'Spark Driver':'';
 const amounts=lines.filter(l=>!/(?:\/\s*(?:mi|hr)|per\s*(?:mile|hour)|bonus|extra|tip alone)/i.test(l)).flatMap(l=>[...l.matchAll(/\$\s*(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)(?![\d.])/g)].map(m=>({value:m[1].replace(/,/g,''),line:l})));
 const totals=amounts.filter(a=>/total|guaranteed|offer pay|earnings/i.test(a.line));
 const candidates=totals.length===1?totals:amounts;
 const pay=candidates.length===1?candidates[0].value:'';
 const address=label=>{const line=lines.find(l=>label.test(l));return line?line.replace(label,'').trim().slice(0,240):'';};
 return {name:source?source+' offer':'Screenshot offer',pay,pickup:address(/^pickup(?: address)?\s*:\s*/i),delivery:address(/^(?:delivery|dropoff|drop-off)(?: address)?\s*:\s*/i),ambiguousPay:amounts.length>1&&!pay};
}
if(typeof module==='object'&&module.exports)module.exports={parse};
root.MileCountOfferImport={parse,init};
function init({userId,onUse,isDemo}){
 const $=id=>document.getElementById(id);let worker,version=0,previewURL,timer;
 function clear(){version++;clearTimeout(timer);worker?.terminate();worker=null;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('importPreview').removeAttribute('src');$('importReview').hidden=true;$('importText').value='';$('importFile').value='';$('importSingle').checked=false;$('importRead').disabled=false;}
 async function sessionOK(){const s=await MileCountCloud.session();if(s?.user?.id!==userId)throw Error('Your session changed. Reload and sign in before importing.');if(isDemo())throw Error('Switch back to My offers before importing.');}
 function sdk(){if(root.Tesseract)return Promise.resolve();return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Text reader could not download. Check your connection and retry.'));};document.head.append(s);});}
 $('importCancel').onclick=()=>{clear();$('importStatus').textContent='Import cleared. No offer was added.';};
 $('importRead').onclick=async()=>{
 const file=$('importFile').files[0];if(!file){$('importStatus').textContent='Choose an offer screenshot first.';return;}
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){$('importStatus').textContent='Choose a PNG, JPG or WebP image under 10 MB.';return;}
 clear();const current=version;$('importRead').disabled=true;$('importStatus').textContent='Loading the text reader… First use may take a minute.';
 timer=setTimeout(()=>{if(current===version){clear();$('importStatus').textContent='Reading timed out. Try a cropped screenshot or enter the offer manually.';}},90000);
 try{
 await sessionOK();previewURL=URL.createObjectURL(file);const img=new Image();img.src=previewURL;await img.decode();if(img.width*img.height>24000000)throw Error('Image is too large. Crop it to one offer and retry.');
 await sdk();if(current!==version)return;
 const w=await Tesseract.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',logger:m=>{if(current===version&&m.status==='recognizing text')$('importStatus').textContent='Reading screenshot… '+Math.round(m.progress*100)+'%';}});
 if(current!==version){await w.terminate();return;}worker=w;
 const {data}=await w.recognize(img);await w.terminate();worker=null;await sessionOK();if(current!==version)return;
 clearTimeout(timer);const text=data.text.slice(0,12000),fields=parse(text);$('importText').value=text;$('importPreview').src=previewURL;
 for(const key of ['name','pay','pickup','delivery'])$('import_'+key).value=fields[key];
 $('importReview').hidden=false;$('importStatus').textContent=text.trim()?'Review every field against the screenshot. '+(fields.ambiguousPay?'Several dollar amounts found; enter the driver’s total pay.':'Missing details must be filled in before saving.'):'No readable text found. You can fill in the review fields or try a clearer screenshot.';
 }catch(e){if(current===version){clear();$('importStatus').textContent=e.message||'Could not read this screenshot. Try another image.';}}
 finally{if(current===version)$('importRead').disabled=false;}
 };
 $('importUse').onclick=async()=>{try{await sessionOK();if(!$('importSingle').checked)throw Error('Confirm this is one pickup and one delivery. Multi-stop batches are not supported by this importer yet.');const fields={};for(const key of ['name','pay','pickup','delivery'])fields[key]=$('import_'+key).value.trim();if(!fields.pay||!Number.isFinite(Number(fields.pay))||Number(fields.pay)<0)throw Error('Enter the total driver pay in dollars.');if(!onUse(fields))return;clear();$('importStatus').textContent='Details copied below. Complete missing addresses and review timing, then Save offer.';}catch(e){$('importStatus').textContent=e.message;}};
 addEventListener('pagehide',clear);
 return {clear};
}
})(typeof window==='undefined'?globalThis:window);
