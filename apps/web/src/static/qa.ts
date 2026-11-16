import { localRequest as r } from './client';
const out=document.querySelector('#result')!;
function log(x: unknown) { out.textContent += `\n${typeof x === 'string' ? x : JSON.stringify(x)}`; }
try {
  log({health:await r('GET','/api/health')});
  const levels=await r('GET','/api/levels'); log({levels:levels.levels.length});
  const s=await r('POST','/api/sessions',{level_id:'tutorial'}); log({created:!!s.session_id});
  const base=`/api/sessions/${s.session_id}`;
  const geo=await r('GET',`${base}/geometry`); log({geometry:geo.items.length});
  const slots=await r('POST',`${base}/list_slots`,{rack:'lower_rack',item_id:'plate_01'});
  const slot=slots.slots.find((x:any)=>x.drop_free && x.drop_seats);
  const placed=await r('POST',`${base}/place`,{item_id:'plate_01',frame:'lower_rack',...slot.suggested_drop}); log({placed:placed.accepted,reason:placed.reason});
  const state=await r('GET',`${base}/scene`); log({placedCount:state.state.placed.length});
  const cycle=await r('POST',`${base}/start_cycle?wash_tier=fast`,{}); log({cycle:cycle.accepted,reason:cycle.reason});
  for(let i=0;i<120;i++) { const result=await r('GET',`${base}/get_report`); if(result.status !== 'running') {log({report:result}); break;} await new Promise(resolve=>setTimeout(resolve,1000)); }
} catch (e) { log(`ERROR: ${e instanceof Error ? e.stack : String(e)}`); }
