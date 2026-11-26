// Native runtime provided by OpenRive (MIT). No backend or voice API credentials.
import {limits,defaults,viseme,clamp,sampleCues,validateCues} from './guide-contract.js';
import {importLockedPack} from './locked-voice.js';
const $=id=>document.getElementById(id);
const reactions=['ready','thinking','listening','favorite','pricedrop','newhome','traveling','arrived','achievement','guide','lookout','ponder','speaking'];
const mouths=['rest','MBP','AI','E','OU','FV','THL','teeth'];
for(const [id,values] of [['reaction',reactions],['mouth',mouths]])values.forEach((s,i)=>$(id).add(new Option(s,String(i))));
let player=null,epoch=0,speechEpoch=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,raf=0,objectURL=null;
const audio=$('speech');
let lockedPack=[],packEpoch=0;
function lockedOptions(){
 const character=$('character').value.split('-').at(-1);
 const items=lockedPack.filter(x=>x.character===character);
 $('locked-line').replaceChildren(...items.map(x=>new Option(x.id,x.id)));
 $('locked-play').disabled=!items.length;
}
$('locked-files').onchange=async()=>{
 const token=++packEpoch;stop();lockedPack=[];lockedOptions();$('locked-status').textContent='Verifying original recordings…';
 try{const pack=await importLockedPack($('locked-files').files);if(token!==packEpoch)return;lockedPack=pack;lockedOptions();$('locked-status').textContent='26/26 original recordings and timing JSON verified. No files uploaded.';}
 catch(e){if(token===packEpoch)$('locked-status').textContent=e.message;}
};
$('locked-play').onclick=async()=>{
 const character=$('character').value.split('-').at(-1),line=lockedPack.find(x=>x.character===character&&x.id===$('locked-line').value);
 if(!line||!player)return;
 stop();const token=++speechEpoch;
 try{
  if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(line.file);audio.src=objectURL;
  audio.playbackRate=1;await audio.play();
  if(token!==speechEpoch)return;
  set('emotion',12);target.speaking=1;
  function tick(){
   if(token!==speechEpoch)return;
   if(audio.ended){resetSpeech();return;}
   Object.assign(target,audio.paused?viseme(0):sampleCues(line.cues,audio.currentTime));target.speaking=audio.paused?0:1;
   raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);
  $('locked-status').textContent=line.text;
 }catch(e){if(token===speechEpoch){resetSpeech();$('locked-status').textContent=e.message;}}
};
const report=s=>$('status').textContent=s;
const values={...defaults},target={...defaults};
const set=(k,v)=>{const x=clamp(k,v);if(player&&values[k]!==x)player.setProperty(k,'number',x);values[k]=x;};
const apply=(obj)=>{for(const [k,v] of Object.entries(obj))set(k,v);};
const mouth=(i)=>Object.assign(target,viseme(i));
function resetSpeech(){mouth(0);apply({...viseme(0),speaking:0});target.speaking=0;set('emotion',Number($('reaction').value));}
let motionFrame=0,lastFrame=0,autoStart=performance.now(),pointerX=0,pointerY=0;
const continuous=Object.keys(limits).filter(k=>!['emotion','mouthShape'].includes(k));
for(const k of continuous){
  const row=document.createElement('label');row.textContent=k+' ';
  const slider=document.createElement('input');slider.type='range';slider.id='prop-'+k;
  slider.min=limits[k][0];slider.max=limits[k][1];slider.step='.01';slider.value=defaults[k];
  slider.addEventListener('input',()=>{if(['lookX','lookY','headX','headY','blink','breath'].includes(k))$('auto').checked=false;target[k]=Number(slider.value);set(k,target[k]);});
  row.append(slider);$('properties').append(row);
}
function animate(t){
  const dt=lastFrame?Math.min(.05,(t-lastFrame)/1000):0;lastFrame=t;
  if(player&&!paused){
    if($('auto').checked){
      const sec=(t-autoStart)/1000,cycle=sec%4.6;
      target.breath=Math.sin(sec*Math.PI/2);
      target.blink=cycle>3.2&&cycle<3.42?Math.sin((cycle-3.2)/.22*Math.PI):0;
      target.lookX=pointerX;target.lookY=pointerY;target.headX=pointerX*.75;target.headY=pointerY*.75;
    }
    for(const k of continuous){const speed=['mouthOpen','mouthWide','teeth','tongue'].includes(k)?35:9;const delta=target[k]-values[k];if(Math.abs(delta)>1e-5)set(k,values[k]+delta*(1-Math.exp(-dt*speed)));else set(k,target[k]);}
    set('mouthShape',target.mouthShape);
  }
  motionFrame=requestAnimationFrame(animate);
}
motionFrame=requestAnimationFrame(animate);
function stop(){speechEpoch++;window.speechSynthesis?.cancel();audio.pause();cancelAnimationFrame(raf);resetSpeech();}
async function load(){
  const token=++epoch;stop();player?.dispose();player=null;
  const selected=$('character').value;
  if(!['questie-pin','questie-geo'].includes(selected))return;
  $('download').href='./'+selected+'/'+selected+'.riv'; report('Loading native Rive…');
  try{
    const mod=await import('./'+selected+'/index.js');
    if(token!==epoch)return;
    const p=await mod.createPlayer({canvas:$('guide'),stateMachine:'Guide',paused});
    if(token!==epoch){p.dispose();return;}
    player=p;
    const names=p.properties().map(x=>x.name);
    if(!Object.keys(limits).every(k=>names.includes(k))||names.length!==13){p.dispose();player=null;throw Error('Native property contract missing');}
    Object.assign(target,defaults,viseme(Number($('mouth').value)));Object.assign(values,defaults);
    for(const [k,v] of Object.entries(target)){player.setProperty(k,'number',v);values[k]=v;}
    set('emotion',Number($('reaction').value));for(const k of continuous)$('prop-'+k).value=String(target[k]);
    report('Native Rive loaded: '+selected+' · 13 verified runtime properties');
  }catch(e){if(token===epoch)report('Native preview failed: '+e.message);}
}
$('character').onchange=()=>{lockedOptions();load();};
$('reaction').onchange=()=>{stop();set('emotion',Number($('reaction').value));};
$('mouth').onchange=()=>{stop();mouth(Number($('mouth').value));if(paused)apply(target);};
$('pause').textContent=paused?'Resume motion':'Pause motion';
$('pause').onclick=()=>{paused=!paused;paused?player?.pause():player?.play();$('pause').textContent=paused?'Resume motion':'Pause motion';};
$('guide').addEventListener('pointermove',e=>{const b=e.currentTarget.getBoundingClientRect();const q=v=>Math.max(-1,Math.min(1,v*2-1));pointerX=q((e.clientX-b.left)/b.width);pointerY=q((e.clientY-b.top)/b.height);});
$('guide').addEventListener('pointerleave',()=>{pointerX=pointerY=0;});
$('stop').onclick=stop;
$('speak').onclick=()=>{
  stop();if(!player)return;if(!window.speechSynthesis){report('Browser speech is unavailable. Use a timed audio file.');return;}
  const token=++speechEpoch, text=$('line').value, u=new SpeechSynthesisUtterance(text);
  u.rate=.9;u.pitch=1.12;
  const shape=ch=>/[mbp]/i.test(ch)?1:/[ou]/i.test(ch)?4:/[fv]/i.test(ch)?5:/[ei]/i.test(ch)?3:/[a]/i.test(ch)?2:6;
  let started=0,offset=0;
  function tick(t){if(token!==speechEpoch)return;if(!started)started=t;const i=Math.min(text.length-1,offset+Math.floor((t-started)/95));mouth(shape(text[i]||''));raf=requestAnimationFrame(tick);}
  u.onstart=()=>{if(token!==speechEpoch)return;set('emotion',12);target.speaking=1;raf=requestAnimationFrame(tick);};
  u.onboundary=e=>{offset=e.charIndex;started=performance.now();};
  u.onend=()=>{if(token===speechEpoch){cancelAnimationFrame(raf);resetSpeech();}};
  u.onerror=()=>{if(token===speechEpoch){cancelAnimationFrame(raf);resetSpeech();report('Browser speech could not play.');}};
  window.speechSynthesis.speak(u);
};
$('timed').onclick=async()=>{
  stop();const token=++speechEpoch;
  try{
    if(!player)throw Error('Load a character first');
    const f=$('audio').files[0],j=$('cues').files[0];
    if(!f||!j||f.size>30*1024*1024||j.size>1024*1024)throw Error('Choose audio under 30 MB and cue JSON under 1 MB');
    const cues=JSON.parse(await j.text());
    if(token!==speechEpoch)return;
    validateCues(cues);
    if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(f);audio.src=objectURL;
    await audio.play();if(token!==speechEpoch){audio.pause();return;}
    set('emotion',12);target.speaking=1;
    function tick(){if(token!==speechEpoch)return;if(audio.ended){resetSpeech();return;}Object.assign(target,audio.paused?viseme(0):sampleCues(cues,audio.currentTime));target.speaking=audio.paused?0:1;raf=requestAnimationFrame(tick);}
    raf=requestAnimationFrame(tick);
  }catch(e){if(token===speechEpoch){resetSpeech();report(e.message);}}
};
window.addEventListener('pagehide',()=>{++epoch;stop();cancelAnimationFrame(motionFrame);player?.dispose();player=null;if(objectURL)URL.revokeObjectURL(objectURL);});
load();
