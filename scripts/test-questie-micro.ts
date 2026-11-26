import assert from 'node:assert/strict';
import { resolve,extname,sep } from 'node:path';
import { chromium } from 'playwright-core';
const root=resolve('questie-site');
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.riv':'application/octet-stream','.css':'text/css'};
const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(req){
 const p=decodeURIComponent(new URL(req.url).pathname),file=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
 if(!file.startsWith(root+sep))return new Response('Forbidden',{status:403});
 const f=Bun.file(file);return await f.exists()?new Response(f,{headers:{'Content-Type':mime[extname(file)]??'application/octet-stream'}}):new Response('Missing',{status:404});
}});
const base='http://127.0.0.1:'+server.port;
try{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [390,1024]){
  const page=await browser.newPage({viewport:{width,height:844}});const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url())});
  await page.goto(base+'/muse-preview.html');
  const state=async(id:string)=>page.waitForFunction(x=>document.querySelector('#status')?.getAttribute('data-behavior')===x,id,{timeout:30000});
  await state('IDLE-PARKED');const canvas=page.locator('#pin');const first=await canvas.screenshot();await page.waitForTimeout(1500);assert.ok(!first.equals(await canvas.screenshot()),'Idle canvas must change');
  await page.locator('#question').fill('down payment');await state('WORK-THINK');await state('TYPE-PONDER');await page.locator('#send').click();await state('WORK-THINK');await state('TYPE-LISTEN');
  assert.match(await page.locator('#reply').innerText(),/portion of the purchase price/);await state('IDLE-PARKED');
  await page.locator('#build').click();await state('WORK-THINK');await state('TYPE-LISTEN');
  await page.locator('#size').selectOption('64');assert.equal(Math.round((await canvas.boundingBox())!.width),64);
  await page.screenshot({path:'questie-site/pin-micro-'+width+'.png'});
  for(const path of ['/embed-example.html','/questie-pin/embed-example.html','/questie-geo/embed-example.html']){
   await page.goto(base+path);await page.locator('#controls button').first().waitFor({timeout:30000});
  }
  assert.deepEqual(errors,[],'Browser errors and failed requests');await page.close();
 }
 }finally{await browser.close()}
}finally{server.stop(true)}
