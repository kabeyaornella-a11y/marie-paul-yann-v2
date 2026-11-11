const CARNET_ORIGIN='https://eventia-carnets-reponses.kabeyaornella.chatgpt.site';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
async function carnetProxy(request,env){
 const url=new URL(request.url),allowed=['/api/rsvp','/api/rsvp/read'];if(!allowed.includes(url.pathname))return json({error:'Page introuvable.'},404);
 if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405);
 if(request.headers.get('Origin')!==url.origin)return json({error:'Requête non autorisée.'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Format invalide.'},415);
 if(!env.CARNET_SERVICE_TOKEN||!/^evenement-[a-f0-9]{16}$/.test(env.CARNET_EVENT_SLUG||''))return json({error:'Le carnet est momentanément indisponible.'},503);
 if(Number(request.headers.get('Content-Length'))>20000)return json({error:'Réponse trop longue.'},413);
 let raw;try{const reader=request.body?.getReader();if(!reader)return json({error:'Réponse vide.'},400);const chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>20000){await reader.cancel();return json({error:'Réponse trop longue.'},413);}chunks.push(value);}const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}raw=new TextDecoder().decode(bytes);JSON.parse(raw);}catch{return json({error:'Réponse invalide.'},400);}
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let phase='fetch';
 try{const upstream=await fetch(CARNET_ORIGIN+'/e/'+env.CARNET_EVENT_SLUG+url.pathname,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Origin:CARNET_ORIGIN,'OAI-Sites-Authorization':'Bearer '+env.CARNET_SERVICE_TOKEN},body:raw,signal:controller.signal});
  phase='response-'+upstream.status;if(!upstream.headers.get('Content-Type')?.includes('application/json'))throw Error('Réponse service inattendue');const data=await upstream.json();if(!upstream.ok)return json({error:typeof data.error==='string'?data.error:'Votre réponse n’a pas pu être confirmée.'},[400,403,404,409,410,413,415,429].includes(upstream.status)?upstream.status:503);
  if(url.pathname.endsWith('/read')){if(!data.response?.id)throw Error('Accès absent');return json({response:data.response});}
  if(data.ok!==true||!data.response?.id||!data.response?.updated_at)throw Error('Accusé absent');return json({ok:true,received:true,id:data.response.id,response:data.response});
 }catch(e){console.error('carnet-proxy',phase,e?.name||'Error',String(e?.message||'').slice(0,160));return json({error:'La connexion au carnet s’est interrompue. Vos informations restent dans le formulaire ; vous pouvez réessayer.'},503);}finally{clearTimeout(timeout);}
}

exports.handler=async event=>{const origin='https://mariage-mariepaul-yann.netlify.app',suffix=event.path.endsWith('/read')?'/read':'';const request=new Request(origin+'/api/rsvp'+suffix,{method:event.httpMethod,headers:event.headers,...(!['GET','HEAD'].includes(event.httpMethod)?{body:event.body||''}:{})});const response=await carnetProxy(request,process.env);return{statusCode:response.status,headers:Object.fromEntries(response.headers),body:await response.text()}};
