// Questie Native Mascot Studio — Phase 5
// Native Rive WASM runtime + in-browser OpenRive native authoring engine + 12-state Muse behavior engine.
// Zero backend API keys; all locked voice files remain local and SHA-1 verified in browser.
import { limits, defaults, viseme, clamp, sampleCues, validateCues } from './guide-contract.js';
import { importLockedPack } from './locked-voice.js';
import { BEHAVIOR_STATES, behaviorForEmotion, createBehaviorEngine } from './behavior-engine.js';
import {
  compileCustomMascot,
  defaultQuestieCustomization,
  exportCustomBundleZip,
} from './mascot-engine.js';

const $ = (id) => document.getElementById(id);

const reactions = [
  'ready', 'thinking', 'listening', 'favorite', 'pricedrop', 'newhome',
  'traveling', 'arrived', 'achievement', 'guide', 'lookout', 'ponder', 'speaking',
];
const mouths = ['rest', 'MBP', 'AI', 'E', 'OU', 'FV', 'THL', 'teeth'];

for (const [id, list] of [['reaction', reactions], ['mouth', mouths]]) {
  list.forEach((label, i) => $(id).add(new Option(`${i} · ${label}`, String(i))));
}

// Curated identity-preserving presets for Pin and Geo
const APPEARANCE_PRESETS = {
  Pin: [
    { name: 'Original Pin', patch: {} },
    { name: 'Warm Sunset', patch: { shellColor: '#f06a5c', shellEdge: '#a23244', shellLight: '#ffd2bd', beaconColor: '#ffad4a', irisColor: '#25394c', irisRingColor: '#568ca3' } },
    { name: 'Rose Quartz', patch: { shellColor: '#e46885', shellEdge: '#8f2e51', shellLight: '#ffc8da', beaconColor: '#ff7fa3', irisColor: '#2a304d', irisRingColor: '#6f7ab5' } },
  ],
  Geo: [
    { name: 'Original Geo', patch: {} },
    { name: 'Deep Lagoon', patch: { shellColor: '#128fa0', shellEdge: '#0b4f69', shellLight: '#9bf3f0', beaconColor: '#55c7ff', irisColor: '#16344a', irisRingColor: '#3693b0' } },
    { name: 'Jade Guide', patch: { shellColor: '#1ca68a', shellEdge: '#10615b', shellLight: '#aff7dc', beaconColor: '#63eab2', irisColor: '#1b3b3d', irisRingColor: '#3da68e' } },
  ],
};

// State
const behavior = createBehaviorEngine();
let player = null;
let epoch = 0;
let speechEpoch = 0;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let speechRaf = 0;
let objectURL = null;
let downloadURL = null;
let lockedPack = [];
let packEpoch = 0;
let activeSpeaking = false;
let currentBytes = null;
let currentCustom = defaultQuestieCustomization('Pin');
let compileTimer = 0;
let runtimeFileCache = null;

const audio = $('speech');
const report = (s) => { $('status').textContent = s; };

const values = { ...defaults };
const target = { ...defaults };

const setProp = (k, v) => {
  const x = clamp(k, v);
  if (player && values[k] !== x) player.setProperty(k, 'number', x);
  values[k] = x;
  const slider = $('prop-' + k);
  const out = $('prop-val-' + k);
  if (slider && document.activeElement !== slider) slider.value = String(x);
  if (out) out.textContent = Number(x).toFixed(2);
};

const applyProps = (obj) => {
  for (const [k, v] of Object.entries(obj)) setProp(k, v);
};

const setMouthTarget = (i) => Object.assign(target, viseme(i));

function activePresetName() {
  return $('character').value === 'questie-geo' ? 'Geo' : 'Pin';
}

// Workbench tabs
const tabButtons = [
  ['tab-btn-behavior', 'tab-behavior'],
  ['tab-btn-appearance', 'tab-appearance'],
  ['tab-btn-voice', 'tab-voice'],
];
for (const [btnId, panelId] of tabButtons) {
  $(btnId).onclick = () => {
    for (const [otherBtn, otherPanel] of tabButtons) {
      const active = otherBtn === btnId;
      $(otherBtn).setAttribute('aria-selected', String(active));
      $(otherPanel).hidden = !active;
    }
  };
}

// Stage backdrop switcher
document.querySelectorAll('.backdrop-segment button').forEach((btn) => {
  btn.onclick = () => {
    const mode = btn.dataset.backdrop;
    $('stage-frame').dataset.backdrop = mode;
    document.querySelectorAll('.backdrop-segment button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
  };
});

// Build 12-state Reactive Behavior Grid
const behaviorGrid = $('behavior-grid');
const behaviorButtons = new Map();
for (const st of BEHAVIOR_STATES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'behavior-btn';
  btn.dataset.stateId = st.id;
  btn.setAttribute('aria-pressed', String(st.id === behavior.state.id));
  const title = document.createElement('span');
  title.className = 'behavior-btn-name';
  title.textContent = st.label;
  const meta = document.createElement('span');
  meta.className = 'behavior-btn-meta';
  meta.textContent = st.verbal ? 'Verbal · ' + st.category : 'Nonverbal · ' + st.category;
  btn.append(title, meta);
  btn.onclick = () => selectBehavior(st.id);
  behaviorGrid.append(btn);
  behaviorButtons.set(st.id, btn);
}

function syncBehaviorUI(stateObj) {
  $('behavior-mode-tag').textContent = stateObj.id;
  $('behavior-desc').textContent = stateObj.note;
  $('reaction').value = String(stateObj.emotion);
  for (const [id, btn] of behaviorButtons) {
    btn.setAttribute('aria-pressed', String(id === stateObj.id));
  }
}

function selectBehavior(id, { preserveAudio = false } = {}) {
  const st = behavior.setState(id);
  if (!preserveAudio && !st.verbal) {
    stopSpeech(false);
  }
  syncBehaviorUI(st);
  setProp('emotion', st.emotion);
  if (!activeSpeaking) {
    target.speaking = 0;
    setProp('speaking', 0);
  }
}

// Build 13-property GuideVM continuous sliders (preserving exact #prop-<name> IDs)
const continuous = Object.keys(limits).filter((k) => !['emotion', 'mouthShape'].includes(k));
for (const k of continuous) {
  const row = document.createElement('label');
  row.className = 'prop-row';
  const head = document.createElement('span');
  head.className = 'prop-row-head';
  const nameEl = document.createElement('span');
  nameEl.textContent = k;
  const out = document.createElement('output');
  out.id = 'prop-val-' + k;
  out.textContent = Number(defaults[k]).toFixed(2);
  head.append(nameEl, out);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.id = 'prop-' + k;
  slider.min = String(limits[k][0]);
  slider.max = String(limits[k][1]);
  slider.step = '0.01';
  slider.value = String(defaults[k]);
  slider.addEventListener('input', () => {
    if (['lookX', 'lookY', 'headX', 'headY', 'blink', 'breath'].includes(k)) {
      $('auto').checked = false;
    }
    const val = Number(slider.value);
    target[k] = val;
    setProp(k, val);
  });
  row.append(head, slider);
  $('properties').append(row);
}

// Locked voice-pack options (strictly per-character)
function lockedOptions() {
  const character = $('character').value.split('-').at(-1);
  const items = lockedPack.filter((x) => x.character === character);
  $('locked-line').replaceChildren(...items.map((x) => new Option(x.id, x.id)));
  $('locked-play').disabled = !items.length;
}

$('locked-files').onchange = async () => {
  const token = ++packEpoch;
  stopSpeech();
  lockedPack = [];
  lockedOptions();
  $('locked-status').textContent = 'Verifying original recordings…';
  try {
    const pack = await importLockedPack($('locked-files').files);
    if (token !== packEpoch) return;
    lockedPack = pack;
    lockedOptions();
    const totalCues = pack.reduce((sum, item) => sum + item.cues.length, 0);
    $('locked-status').textContent = `26/26 original recordings verified locally (${totalCues} cues loaded). No files uploaded.`;
  } catch (e) {
    if (token === packEpoch) $('locked-status').textContent = e.message;
  }
};

function resetSpeech(restoreBehavior = true) {
  activeSpeaking = false;
  setMouthTarget(0);
  applyProps({ ...viseme(0), speaking: 0 });
  target.speaking = 0;
  if (restoreBehavior) {
    setProp('emotion', Number($('reaction').value));
  }
}

function stopSpeech(restoreBehavior = true) {
  speechEpoch++;
  window.speechSynthesis?.cancel();
  audio.pause();
  cancelAnimationFrame(speechRaf);
  resetSpeech(restoreBehavior);
}

$('locked-play').onclick = async () => {
  const character = $('character').value.split('-').at(-1);
  const line = lockedPack.find((x) => x.character === character && x.id === $('locked-line').value);
  if (!line || !player) return;
  stopSpeech(false);
  const token = ++speechEpoch;
  try {
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(line.file);
    audio.src = objectURL;
    audio.playbackRate = 1;
    await audio.play();
    if (token !== speechEpoch) return;
    activeSpeaking = true;
    selectBehavior('SPEAK-ATTEND', { preserveAudio: true });
    target.speaking = 1;
    function tick() {
      if (token !== speechEpoch) return;
      if (audio.ended) {
        resetSpeech(true);
        return;
      }
      const playing = !audio.paused;
      Object.assign(target, playing ? sampleCues(line.cues, audio.currentTime) : viseme(0));
      target.speaking = playing ? 1 : 0;
      activeSpeaking = playing;
      speechRaf = requestAnimationFrame(tick);
    }
    speechRaf = requestAnimationFrame(tick);
    $('locked-status').textContent = line.text;
  } catch (e) {
    if (token === speechEpoch) {
      resetSpeech(true);
      $('locked-status').textContent = e.message;
    }
  }
};

// Main layered animation loop (Autonomic breath + natural double-blink + independent gaze + smooth speech)
let motionFrame = 0;
let lastFrame = 0;

function animate(t) {
  const dt = lastFrame ? Math.min(0.05, (t - lastFrame) / 1000) : 0;
  lastFrame = t;

  if (player && !paused) {
    let eyeSpeed = 12;
    let headSpeed = 5.5;

    if ($('auto').checked) {
      const mouthEnergy = Math.max(0, Math.min(1, (values.mouthOpen - 0.2) * 1.4));
      const frame = behavior.step(dt, {
        speakingLevel: values.speaking,
        mouthEnergy,
      });
      target.breath = frame.breath;
      target.blink = frame.blink;
      target.lookX = frame.lookX;
      target.lookY = frame.lookY;
      target.headX = frame.headX;
      target.headY = frame.headY;
      eyeSpeed = frame.eyeFollowSpeed;
      headSpeed = frame.headFollowSpeed;
    }

    for (const k of continuous) {
      let speed = 10;
      if (['mouthOpen', 'mouthWide', 'teeth', 'tongue'].includes(k)) speed = 34;
      else if (k === 'blink') speed = 48;
      else if (k === 'lookX' || k === 'lookY') speed = eyeSpeed;
      else if (k === 'headX' || k === 'headY') speed = headSpeed;
      else if (k === 'breath') speed = 6;
      else if (k === 'speaking') speed = 11;

      const delta = target[k] - values[k];
      if (Math.abs(delta) > 1e-5) {
        setProp(k, values[k] + delta * (1 - Math.exp(-dt * speed)));
      } else {
        setProp(k, target[k]);
      }
    }
    setProp('mouthShape', target.mouthShape);
  }
  motionFrame = requestAnimationFrame(animate);
}
motionFrame = requestAnimationFrame(animate);

// Update download link with current native .riv bytes (canonical or customized)
function updateDownloadLink(selectedId, bytes) {
  currentBytes = bytes;
  const fileName = `${selectedId}.riv`;
  if (bytes) {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    $('download').href = downloadURL;
    $('download').download = fileName;
    $('download-top').href = downloadURL;
    $('download-top').download = fileName;
    $('riv-meta').textContent = `Native .riv · ${(bytes.length / 1024).toFixed(1)} KB`;
  } else {
    const fallback = `./${selectedId}/${selectedId}.riv`;
    $('download').href = fallback;
    $('download').download = fileName;
    $('download-top').href = fallback;
    $('download-top').download = fileName;
    $('riv-meta').textContent = 'Native .riv';
  }
}

// Appearance & Rig UI synchronization
function renderAppearancePresets() {
  const preset = activePresetName();
  const container = $('appearance-presets');
  container.replaceChildren();
  for (const item of APPEARANCE_PRESETS[preset]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    const dot = document.createElement('span');
    dot.className = 'swatch-dot';
    dot.style.background = item.patch.shellColor || defaultQuestieCustomization(preset).shellColor;
    btn.append(dot, document.createTextNode(item.name));
    btn.onclick = () => {
      currentCustom = { ...defaultQuestieCustomization(preset), ...item.patch };
      syncCustomInputsFromState();
      scheduleCustomCompile();
    };
    container.append(btn);
  }
}

function syncCustomInputsFromState() {
  $('cust-shell').value = currentCustom.shellColor;
  $('cust-edge').value = currentCustom.shellEdge;
  $('cust-light').value = currentCustom.shellLight;
  $('cust-beacon').value = currentCustom.beaconColor;
  $('cust-blush').value = currentCustom.blushColor;
  $('cust-backpack').value = currentCustom.backpackColor;
  $('cust-gloss').value = String(currentCustom.glossOpacity);
  $('val-cust-gloss').textContent = `${Math.round(currentCustom.glossOpacity * 100)}%`;
  $('cust-show-backpack').checked = !!currentCustom.showBackpack;

  $('cust-iris').value = currentCustom.irisColor;
  $('cust-iris-ring').value = currentCustom.irisRingColor;
  $('cust-sclera').value = currentCustom.scleraColor;
  $('cust-eye-scale').value = String(currentCustom.eyeScale);
  $('val-cust-eye-scale').textContent = `${Math.round(currentCustom.eyeScale * 100)}%`;
  $('cust-iris-scale').value = String(currentCustom.irisScale);
  $('val-cust-iris-scale').textContent = `${Math.round(currentCustom.irisScale * 100)}%`;
  $('cust-glint').value = currentCustom.glintStyle;
  $('cust-brow-thick').value = String(currentCustom.browThickness);
  $('val-cust-brow-thick').textContent = `${currentCustom.browThickness.toFixed(1)} px`;
  $('cust-brow-arch').value = String(currentCustom.browArch);
  $('val-cust-brow-arch').textContent = currentCustom.browArch.toFixed(1);

  $('rig-parallax').value = String(currentCustom.parallaxDepth);
  $('val-rig-parallax').textContent = `${currentCustom.parallaxDepth.toFixed(2)}×`;
  $('rig-eye-track').value = String(currentCustom.eyeTrackingRange);
  $('val-rig-eye-track').textContent = `${currentCustom.eyeTrackingRange.toFixed(2)}×`;
  $('rig-breath').value = String(currentCustom.breathingScale);
  $('val-rig-breath').textContent = `${currentCustom.breathingScale.toFixed(2)}×`;
  $('rig-mouth-scale').value = String(currentCustom.mouthScale);
  $('val-rig-mouth-scale').textContent = `${currentCustom.mouthScale.toFixed(2)}×`;
}

function readCustomFromInputs() {
  currentCustom = {
    ...currentCustom,
    preset: activePresetName(),
    shellColor: $('cust-shell').value,
    shellEdge: $('cust-edge').value,
    shellLight: $('cust-light').value,
    beaconColor: $('cust-beacon').value,
    blushColor: $('cust-blush').value,
    backpackColor: $('cust-backpack').value,
    glossOpacity: Number($('cust-gloss').value),
    showBackpack: $('cust-show-backpack').checked,
    irisColor: $('cust-iris').value,
    irisRingColor: $('cust-iris-ring').value,
    scleraColor: $('cust-sclera').value,
    eyeScale: Number($('cust-eye-scale').value),
    irisScale: Number($('cust-iris-scale').value),
    glintStyle: $('cust-glint').value,
    browThickness: Number($('cust-brow-thick').value),
    browArch: Number($('cust-brow-arch').value),
    parallaxDepth: Number($('rig-parallax').value),
    eyeTrackingRange: Number($('rig-eye-track').value),
    breathingScale: Number($('rig-breath').value),
    mouthScale: Number($('rig-mouth-scale').value),
  };
  syncCustomInputsFromState();
}

function scheduleCustomCompile() {
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => {
    try {
      const compiled = compileCustomMascot(activePresetName(), currentCustom);
      load({ customBytes: compiled.bytes, preserveState: true });
    } catch (e) {
      report('Native re-authoring failed: ' + e.message);
    }
  }, 60);
}

for (const id of [
  'cust-shell', 'cust-edge', 'cust-light', 'cust-beacon', 'cust-blush', 'cust-backpack',
  'cust-gloss', 'cust-show-backpack', 'cust-iris', 'cust-iris-ring', 'cust-sclera',
  'cust-eye-scale', 'cust-iris-scale', 'cust-glint', 'cust-brow-thick', 'cust-brow-arch',
  'rig-parallax', 'rig-eye-track', 'rig-breath', 'rig-mouth-scale',
]) {
  $(id).addEventListener('input', () => {
    readCustomFromInputs();
    scheduleCustomCompile();
  });
}

// Live behavior dynamics sliders (no .riv recompile needed — immediate smooth response)
$('dyn-head-inertia').addEventListener('input', () => {
  const v = Number($('dyn-head-inertia').value);
  behavior.dynamics.headInertia = v;
  $('val-dyn-head-inertia').textContent = `${v.toFixed(2)}×`;
});
$('dyn-double-blink').addEventListener('input', () => {
  const v = Number($('dyn-double-blink').value);
  behavior.dynamics.doubleBlinkRate = v;
  $('val-dyn-double-blink').textContent = `${v.toFixed(2)}×`;
});

// Load native Rive WASM player (canonical bundled .riv OR live-authored custom .riv bytes)
async function load({ customBytes = null, preserveState = false } = {}) {
  const token = ++epoch;
  if (!preserveState) stopSpeech(false);
  player?.dispose();
  player = null;

  const selected = $('character').value;
  if (!['questie-pin', 'questie-geo'].includes(selected)) return;
  report('Loading native Rive…');

  try {
    const mod = await import('./' + selected + '/index.js');
    if (token !== epoch) return;

    const bytesToLoad = customBytes ?? (await mod.loadFile());
    if (token !== epoch) return;

    const p = await mod.createPlayer({
      canvas: $('guide'),
      bytes: bytesToLoad,
      stateMachine: 'Guide',
      paused,
    });
    if (token !== epoch) {
      p.dispose();
      return;
    }

    player = p;
    const names = p.properties().map((x) => x.name);
    if (!Object.keys(limits).every((k) => names.includes(k)) || names.length !== 13) {
      p.dispose();
      player = null;
      throw Error('Native property contract missing');
    }

    if (!preserveState) {
      Object.assign(target, defaults, viseme(Number($('mouth').value)));
      Object.assign(values, defaults);
    }
    for (const [k, v] of Object.entries(target)) {
      player.setProperty(k, 'number', v);
      values[k] = v;
    }
    setProp('emotion', Number($('reaction').value));
    for (const k of continuous) {
      const slider = $('prop-' + k);
      const out = $('prop-val-' + k);
      if (slider) slider.value = String(target[k]);
      if (out) out.textContent = Number(target[k]).toFixed(2);
    }

    updateDownloadLink(selected, bytesToLoad);
    const suffix = customBytes ? ' · custom native rig' : '';
    report(`Native Rive loaded: ${selected} · 13 verified runtime properties${suffix}`);
  } catch (e) {
    if (token === epoch) report('Native preview failed: ' + e.message);
  }
}

// Character switching & reset
$('character').onchange = () => {
  const preset = activePresetName();
  currentCustom = defaultQuestieCustomization(preset);
  renderAppearancePresets();
  syncCustomInputsFromState();
  lockedOptions();
  load();
};

$('reset-custom').onclick = () => {
  const preset = activePresetName();
  currentCustom = defaultQuestieCustomization(preset);
  behavior.dynamics.headInertia = 1;
  behavior.dynamics.doubleBlinkRate = 1;
  $('dyn-head-inertia').value = '1';
  $('val-dyn-head-inertia').textContent = '1.00×';
  $('dyn-double-blink').value = '1';
  $('val-dyn-double-blink').textContent = '1.00×';
  syncCustomInputsFromState();
  selectBehavior('IDLE-PARKED');
  load();
};

// Direct reaction & mouth selectors (preserved for full backward compatibility + acceptance tests)
$('reaction').onchange = () => {
  const idx = Number($('reaction').value);
  const matched = behaviorForEmotion(idx);
  if (matched && matched.emotion === idx) {
    selectBehavior(matched.id);
  } else {
    stopSpeech(false);
    setProp('emotion', idx);
  }
};

$('mouth').onchange = () => {
  stopSpeech(false);
  setMouthTarget(Number($('mouth').value));
  if (paused) applyProps(target);
};

$('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
$('pause').onclick = () => {
  paused = !paused;
  paused ? player?.pause() : player?.play();
  $('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
};

$('trigger-blink').onclick = () => {
  behavior.triggerBlink(true);
};

// Pointer gaze tracking with smooth resting return on leave
const canvasEl = $('guide');
canvasEl.addEventListener('pointermove', (e) => {
  const b = e.currentTarget.getBoundingClientRect();
  const norm = (v) => Math.max(-1, Math.min(1, v * 2 - 1));
  behavior.setPointer(norm((e.clientX - b.left) / b.width), norm((e.clientY - b.top) / b.height), true);
});
canvasEl.addEventListener('pointerleave', () => {
  behavior.setPointer(0, 0, false);
});

// Speech & timed local recording controls
$('stop').onclick = () => stopSpeech(true);

$('speak').onclick = () => {
  stopSpeech(false);
  if (!player) return;
  if (!window.speechSynthesis) {
    report('Browser speech is unavailable. Use a timed audio file.');
    return;
  }
  const token = ++speechEpoch;
  const text = $('line').value;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;
  u.pitch = 1.08;
  const shape = (ch) =>
    /[mbp]/i.test(ch) ? 1 : /[ou]/i.test(ch) ? 4 : /[fv]/i.test(ch) ? 5 : /[ei]/i.test(ch) ? 3 : /[a]/i.test(ch) ? 2 : 6;
  let started = 0;
  let offset = 0;
  function tick(ts) {
    if (token !== speechEpoch) return;
    if (!started) started = ts;
    const i = Math.min(text.length - 1, offset + Math.floor((ts - started) / 95));
    setMouthTarget(shape(text[i] || ''));
    speechRaf = requestAnimationFrame(tick);
  }
  u.onstart = () => {
    if (token !== speechEpoch) return;
    activeSpeaking = true;
    selectBehavior('SPEAK-ATTEND', { preserveAudio: true });
    target.speaking = 1;
    speechRaf = requestAnimationFrame(tick);
  };
  u.onboundary = (e) => {
    offset = e.charIndex;
    started = performance.now();
  };
  u.onend = () => {
    if (token === speechEpoch) {
      cancelAnimationFrame(speechRaf);
      resetSpeech(true);
    }
  };
  u.onerror = () => {
    if (token === speechEpoch) {
      cancelAnimationFrame(speechRaf);
      resetSpeech(true);
      report('Browser speech could not play.');
    }
  };
  window.speechSynthesis.speak(u);
};

$('timed').onclick = async () => {
  stopSpeech(false);
  const token = ++speechEpoch;
  try {
    if (!player) throw Error('Load a character first');
    const f = $('audio').files[0];
    const j = $('cues').files[0];
    if (!f || !j || f.size > 30 * 1024 * 1024 || j.size > 1024 * 1024) {
      throw Error('Choose audio under 30 MB and cue JSON under 1 MB');
    }
    const cues = JSON.parse(await j.text());
    if (token !== speechEpoch) return;
    validateCues(cues);
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(f);
    audio.src = objectURL;
    await audio.play();
    if (token !== speechEpoch) {
      audio.pause();
      return;
    }
    activeSpeaking = true;
    selectBehavior('SPEAK-ATTEND', { preserveAudio: true });
    target.speaking = 1;
    function tick() {
      if (token !== speechEpoch) return;
      if (audio.ended) {
        resetSpeech(true);
        return;
      }
      const playing = !audio.paused;
      Object.assign(target, playing ? sampleCues(cues, audio.currentTime) : viseme(0));
      target.speaking = playing ? 1 : 0;
      activeSpeaking = playing;
      speechRaf = requestAnimationFrame(tick);
    }
    speechRaf = requestAnimationFrame(tick);
  } catch (e) {
    if (token === speechEpoch) {
      resetSpeech(true);
      report(e.message);
    }
  }
};

// Export complete standalone offline Rive bundle (.zip) using native OpenRive bundle builder
async function loadVendoredRuntimeFiles() {
  if (runtimeFileCache) return runtimeFileCache;
  const base = `./${$('character').value}/runtime/`;
  const names = ['canvas_advanced.mjs', 'rive.wasm'];
  runtimeFileCache = await Promise.all(
    names.map(async (name) => {
      const res = await fetch(base + name);
      if (!res.ok) throw new Error('Could not fetch runtime ' + name);
      return { name, data: new Uint8Array(await res.arrayBuffer()) };
    }),
  );
  return runtimeFileCache;
}

$('export-zip').onclick = async () => {
  const btn = $('export-zip');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Building .zip…';
  try {
    const runtimeFiles = await loadVendoredRuntimeFiles();
    const selected = $('character').value;
    const zipBytes = exportCustomBundleZip(selected, activePresetName(), currentCustom, runtimeFiles);
    const url = URL.createObjectURL(new Blob([zipBytes], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected}-native-bundle.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    report(`Exported standalone offline Rive bundle (${(zipBytes.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (e) {
    report('Bundle export failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
};

// Recipe JSON export/import
$('export-recipe').onclick = () => {
  const payload = {
    version: 'questie-phase5-recipe-1',
    character: $('character').value,
    customization: currentCustom,
    dynamics: { ...behavior.dynamics },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${$('character').value}-recipe.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  $('recipe-status').textContent = 'Recipe JSON downloaded.';
};

$('import-recipe').onchange = async () => {
  const file = $('import-recipe').files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const preset = parsed?.customization?.preset === 'Geo' || parsed?.character === 'questie-geo' ? 'Geo' : 'Pin';
    $('character').value = preset === 'Geo' ? 'questie-geo' : 'questie-pin';
    currentCustom = { ...defaultQuestieCustomization(preset), ...(parsed.customization ?? {}), preset };
    if (parsed.dynamics) {
      if (Number.isFinite(parsed.dynamics.headInertia)) behavior.dynamics.headInertia = parsed.dynamics.headInertia;
      if (Number.isFinite(parsed.dynamics.doubleBlinkRate)) behavior.dynamics.doubleBlinkRate = parsed.dynamics.doubleBlinkRate;
      $('dyn-head-inertia').value = String(behavior.dynamics.headInertia);
      $('val-dyn-head-inertia').textContent = `${behavior.dynamics.headInertia.toFixed(2)}×`;
      $('dyn-double-blink').value = String(behavior.dynamics.doubleBlinkRate);
      $('val-dyn-double-blink').textContent = `${behavior.dynamics.doubleBlinkRate.toFixed(2)}×`;
    }
    renderAppearancePresets();
    syncCustomInputsFromState();
    lockedOptions();
    const compiled = compileCustomMascot(preset, currentCustom);
    await load({ customBytes: compiled.bytes });
    $('recipe-status').textContent = `Imported recipe for ${preset} and compiled native .riv.`;
  } catch (e) {
    $('recipe-status').textContent = 'Invalid recipe JSON: ' + e.message;
  }
  $('import-recipe').value = '';
};

window.addEventListener('pagehide', () => {
  ++epoch;
  stopSpeech(false);
  cancelAnimationFrame(motionFrame);
  player?.dispose();
  player = null;
  if (objectURL) URL.revokeObjectURL(objectURL);
  if (downloadURL) URL.revokeObjectURL(downloadURL);
});

// Initialize studio
renderAppearancePresets();
syncCustomInputsFromState();
syncBehaviorUI(behavior.state);
lockedOptions();
load();
