/** Local implementation of the web client's API; game state never leaves the browser. */
import { allLevels, levelCard } from '../../../../packages/levels/src/index.ts';
import { createSession } from '../../../../packages/session/src/index.ts';
import { sceneView, geometryPayload } from '../../../../packages/server/src/draw.ts';
import { guidancePayload } from '../../../../packages/server/src/guidance.ts';

const sessions = new Map<string, any>();
const levels = allLevels();
async function create(levelId: string) {
  const level = levels.find((x) => x.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  const id = crypto.randomUUID();
  const e: any = { id, level, tier: 'fast', maps: new Map(), actions: [], stage: null }; 
  e.session = await createSession({ level, washRunner: (manifest, onProgress) => new Promise((resolve, reject) => {
    // Avoid launching the very large simulator for an empty load.
    if (!manifest.items.length) {
      resolve({ benchmark_version: manifest.load.benchmark_version, level_id: manifest.load.level_id, state_hash: manifest.load.state_hash, job: { status:'done', runtime_s:0, fidelity:e.tier, notes:['Nothing was loaded.'] }, score: { points:0, points_available: level.items.reduce((n, x) => n + x.points, 0), graded_points:0, points_loaded:0 }, items: level.items.map((x) => ({item_id:x.id, loaded:false})) }); return;
    }
    const worker = new Worker(new URL('./wash-worker.ts', import.meta.url), {type:'module'});
    worker.onmessage = (event) => { const m = event.data; if (m.type === 'progress') { const stages = ['scene','hydraulics','exposure','soil','replay','result']; const index = Math.max(0, stages.indexOf(m.stage)); const labels: Record<string,string> = {scene:'Measuring the machine and load', hydraulics:'Calculating the spray', exposure:'Tracing water over the load', soil:'Laying soil on the items', replay:'Simulating the wash', result:'Inspecting the items'}; e.stage = {stage:m.stage,label:labels[m.stage] ?? m.stage,index:index+1,count:stages.length,fraction:m.progress,eta_s:null,elapsed_s:(performance.now()-e.startedAt)/1000}; onProgress((index + m.progress) / stages.length); } else if (m.type === 'done') { e.maps = new Map(m.residue.map((r: any) => [r.item_id,r])); worker.terminate(); resolve(m.report); } else if (m.type === 'error') { worker.terminate(); reject(new Error(m.error)); } };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message || 'Wash worker failed')); };
    worker.postMessage({manifest, tier:e.tier});
  }) });
  sessions.set(id,e);
  return e;
}
function created(e: any) { return {session_id:e.id, level_id:e.level.id, level:e.session.card, scene:sceneView(e.session), ws_path:''}; }
async function request(method: string, path: string, body: any) {
  const u = new URL(path, 'https://local.invalid'); const parts = u.pathname.split('/').filter(Boolean);
  if (u.pathname === '/api/health') return {ok:true, benchmark_mode:false, wash_choice:true};
  if (u.pathname === '/api/guidance') return guidancePayload();
  if (u.pathname === '/api/levels') return { levels: levels.map(l => ({id:l.id,title:l.title,summary:l.summary,items:l.items.length,points_available:l.items.reduce((n,x)=>n+x.points,0)})) };
  if (parts[1] === 'levels') { const level = levels.find(x=>x.id === decodeURIComponent(parts[2] ?? '')); if(!level) throw Error('Unknown level'); return levelCard(level); }
  if (u.pathname === '/api/sessions' && method === 'POST') return created(await create(body.level_id));
  const id = decodeURIComponent(parts[2] ?? ''); const e = sessions.get(id); if(!e) throw Error('Session expired. Start a new game.');
  const s = e.session; const action = parts[3];
  if (!action) { const state=s.peekState(), j=s.washJob(); return {session_id:id,level_id:e.level.id,phase:state.phase,state_hash:state.state_hash,budget:state.budget,events:s.actionLog().length,job:j?{job_id:j.id,status:j.status,progress:j.progress}:null,player:null}; }
  if (action === 'player') return {player:null, benchmark_mode:false,name_wanted:false};
  if (action === 'scene') return sceneView(s);
  if (action === 'geometry') return geometryPayload(s);
  if (action === 'card') return s.card;
  if (action === 'wash_options') { const items=s.peekState().placed.filter((p:any)=>p.location !== 'outside').length; return {choice:true,tier:'fast',items,options:[{tier:'fast',scored:false,seconds:60,basis:'built-in'},{tier:'official',scored:true,seconds:300,basis:'built-in'}]}; }
  if (action === 'residue_map') { const map=e.maps.get(u.searchParams.get('item_id')); return map ? {accepted:true,map}:{accepted:false,reason:'no_residue_map'}; }
  if (action === 'rewash') { const next=await create(e.level.id); next.tier=body.wash_tier ?? 'official'; next.startedAt=performance.now(); for(const [op,arg] of e.actions) { const result=next.session[op](arg); if (!result.accepted) throw Error('Could not replay the load for the full wash'); next.actions.push([op,arg]); } const result=next.session.startCycle({}); if(!result.accepted) throw Error('Could not start full wash'); return created(next); }
  const calls: Record<string,string> = {place:'place',remove:'remove',reset:'reset',set_rack:'setRack',start_cycle:'startCycle',preview:'preview',list_slots:'listSlots',check_load:'checkLoad',get_report:'getReport'};
  const fn=calls[action]; if (!fn) throw Error(`Unsupported local operation ${action}`);
  if(action === 'start_cycle') { e.tier=u.searchParams.get('wash_tier') ?? 'fast'; e.startedAt=performance.now(); }
  const result=s[fn](body ?? {});
  if (action === 'get_report' && result.accepted && result.status === 'running' && e.stage) return {...result, stage:e.stage};
  if (['place','remove','reset','set_rack'].includes(action) && result.accepted) e.actions.push([fn,body ?? {}]);
  return result;
}
self.onmessage = async (event) => { const {id,method,path,body}=event.data; try { self.postMessage({id,result:await request(method,path,body)}); } catch(error) { self.postMessage({id,error:error instanceof Error ? error.message : String(error)}); } };
