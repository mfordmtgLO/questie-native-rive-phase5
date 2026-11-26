// Shared host contract: ranges exactly match the V4 guide-contract.json.
export const limits={lookX:[-1,1],lookY:[-1,1],headX:[-1,1],headY:[-1,1],blink:[0,1],mouthOpen:[0,1],mouthWide:[0,1],teeth:[0,1],tongue:[0,1],breath:[-1,1],emotion:[0,12],speaking:[0,1],mouthShape:[0,7]};
export const shapes=[[7,1.4,0,0],[7,.65,0,0],[7.5,5.1,0,1],[9.5,2.6,1,0],[3.9,5.3,0,0],[8,1.9,1,0],[6.3,3.5,1,1],[8.7,2,1,0]];
export const defaults={lookX:0,lookY:0,headX:0,headY:0,blink:0,mouthOpen:1.4/6,mouthWide:.7,teeth:0,tongue:0,breath:0,emotion:0,speaking:0,mouthShape:0};
export function viseme(i){const [w,h,teeth,tongue]=shapes[i]??shapes[0];return {mouthWide:w/10,mouthOpen:h/6,teeth,tongue,mouthShape:i};}
export function clamp(name,v){if(!Object.hasOwn(limits,name)||!Number.isFinite(v))throw Error('Invalid GuideVM property '+name);const [min,max]=limits[name];return Math.max(min,Math.min(max,['emotion','mouthShape'].includes(name)?Math.round(v):v));}
const lerp=(a,b,t)=>a+(b-a)*t;
export function sampleCues(cues,time,blend=.085){
  let l=0,r=cues.length;while(l<r){const m=(l+r)>>1;if(cues[m].time<=time)l=m+1;else r=m;}
  const previous=l?cues[l-1]:{time:0,mouthShape:0},next=cues[l];
  const from=viseme(previous.mouthShape),to=next?viseme(next.mouthShape):from;
  const window=next?Math.min(blend,Math.max(0,next.time-previous.time)):0;
  const u=window?Math.max(0,Math.min(1,(time-(next.time-window))/window)):0;
  const f=u*u*(3-2*u);
  return {mouthOpen:lerp(from.mouthOpen,to.mouthOpen,f),mouthWide:lerp(from.mouthWide,to.mouthWide,f),teeth:lerp(from.teeth,to.teeth,f),tongue:lerp(from.tongue,to.tongue,f),mouthShape:f>.5?to.mouthShape:from.mouthShape};
}
export function validateCues(cues){if(!Array.isArray(cues)||!cues.length||cues.length>20000||cues.some((c,i)=>!Number.isFinite(c?.time)||c.time<0||(i&&c.time<=cues[i-1].time)||!Number.isInteger(c.mouthShape)||c.mouthShape<0||c.mouthShape>7))throw Error('Invalid ordered cue array');return cues;}
