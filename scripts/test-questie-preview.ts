import assert from 'node:assert/strict';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright-core';
const root=resolve('questie-site');
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.riv':'application/octet-stream','.css':'text/css'};
const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(req){
  const path=decodeURIComponent(new URL(req.url).pathname);
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!file.startsWith(root+sep))return new Response('Forbidden',{status:403});
  const f=Bun.file(file);
  return await f.exists()?new Response(f,{headers:{'Content-Type':mime[extname(file)]??'application/octet-stream'}}):new Response('Not found',{status:404});
}});
try{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:900}});
    const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.port);
    for(const guide of ['questie-pin','questie-geo']){
      await page.selectOption('#character',guide);
      await page.waitForFunction(guide=>document.querySelector('#status')?.textContent?.includes('Native Rive loaded: '+guide),guide,{timeout:30000});
      await page.waitForTimeout(350);
      await page.uncheck('#auto');
      await page.locator('details').evaluate(e=>{e.open=true;});
      const slider=async(name:string,value:number)=>{
        await page.locator('#prop-'+name).evaluate((el,value)=>{const input=el as HTMLInputElement;input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
        await page.waitForTimeout(150);
      };
      for(const name of ['lookX','lookY','headX','headY','blink','mouthOpen','mouthWide','teeth','tongue','breath','speaking']){
        const input=page.locator('#prop-'+name);
        const min=Number(await input.getAttribute('min')),max=Number(await input.getAttribute('max'));
        // Compare stable visual states with the host auto motion disabled.
        await slider(name,min);const low=await page.locator('#guide').screenshot();
        await slider(name,max);const high=await page.locator('#guide').screenshot();
        assert.ok(!low.equals(high),'Native property did not change the canvas: '+name);
        await slider(name,name==='mouthWide'?.7:name==='mouthOpen'?.5:0);
      }
      await page.locator('details').evaluate(e=>{e.open=false;});
      for(let i=0;i<8;i++){await page.selectOption('#mouth',String(i));await page.waitForTimeout(100);}
      for(let i=0;i<13;i++){await page.selectOption('#reaction',String(i));await page.waitForTimeout(250);}
      const canvas=page.locator('#guide');
      await canvas.hover({position:{x:20,y:60}});await page.waitForTimeout(200);
      await canvas.hover({position:{x:250,y:200}});await page.waitForTimeout(200);
      await page.selectOption('#reaction','0');
      await page.selectOption('#mouth','0');await page.waitForTimeout(300);
      const a=await canvas.screenshot();
      await page.selectOption('#mouth','4');await page.waitForTimeout(300);
      const b=await canvas.screenshot();
      assert.ok(!a.equals(b),'Canvas did not change across mouth poses');
      await page.screenshot({path:'questie-site/'+guide+'-preview.png'});
      console.log(guide,'runtime loaded, mouth and reaction controls exercised');
    }
    assert.deepEqual(errors,[],'Browser runtime errors');
  }finally{await browser.close();}
}finally{server.stop(true);}
