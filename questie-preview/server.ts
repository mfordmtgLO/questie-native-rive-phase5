import { resolve, sep } from 'node:path';
const root = resolve(import.meta.dir, '../questie-site');
const mime:Record<string,string>={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',wasm:'application/wasm',riv:'application/octet-stream',css:'text/css; charset=utf-8',json:'application/json',png:'image/png'};
const port=Number(process.env.PORT??8080);
const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-cache'};
Bun.serve({hostname:'0.0.0.0',port,async fetch(req){
  if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  let path:string;
  try{path=decodeURIComponent(new URL(req.url).pathname);}catch{return new Response('Bad request',{status:400,headers});}
  if(path==='/healthz')return new Response(req.method==='HEAD'?null:'ok',{headers});
  if(path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p==='..'||p.startsWith('.')))return new Response('Not found',{status:404,headers});
  if(path.endsWith('/'))path+='index.html';
  else if(!path.split('/').at(-1)?.includes('.'))return Response.redirect(new URL(path+'/'+new URL(req.url).search,req.url),308);
  const filePath=resolve(root,'.'+path);
  if(!filePath.startsWith(root+sep))return new Response('Not found',{status:404,headers});
  const file=Bun.file(filePath);
  if(!(await file.exists()))return new Response('Not found',{status:404,headers});
  return new Response(req.method==='HEAD'?null:file,{headers:{...headers,'Content-Type':mime[filePath.split('.').at(-1)??'']??'application/octet-stream','Content-Length':String(file.size)}});
}});
console.log('Questie preview listening on port '+port);
