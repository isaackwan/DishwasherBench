let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (value:any)=>void; reject:(reason:Error)=>void }>();
export function localRequest(method:string,path:string,body?:unknown): Promise<any> {
  if (!worker) { worker = new Worker(new URL('./session-worker.ts', import.meta.url), {type:'module'}); worker.onmessage = (event) => { const {id,result,error}=event.data; const promise=pending.get(id); if(!promise) return; pending.delete(id); error ? promise.reject(new Error(error)) : promise.resolve(result); }; worker.onerror = (event) => { for (const p of pending.values()) p.reject(new Error(event.message || 'Game worker failed')); pending.clear(); }; }
  const id=++sequence; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); worker!.postMessage({id,method,path,body}); });
}
