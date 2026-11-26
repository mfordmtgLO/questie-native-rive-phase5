// Questie Native Mascot Studio — Phase 5.2
// Uses the exact same portable Questie Living Mascot SDK (questie-sdk.js) that ships inside
// exported standalone bundles, ensuring zero studio-only cosmetic motion.
// Native .riv handles articulated anatomy, arms/hands, laptop prop, breathing, blinking, gaze
// drift, and 13 reactive performances; the SDK orchestrates events, pointer gaze, and audio sync.
import { limits, defaults, viseme, validateCues } from './guide-contract.js';
import { importLockedPack } from './locked-voice.js';
import { BEHAVIOR_STATES, behaviorForEmotion, createBehaviorEngine } from './behavior-engine.js';
import { mountQuestieMascot } from './questie-sdk.js';
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
const BACKDROPS = ['dark', 'slate', 'light'];
const BACKDROP_LABELS = { dark: 'Dark', slate: 'Slate', light: 'Light' };

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

// Shared behavior engine persists seamlessly across mascot switches & live .riv recompiles
const behavior = createBehaviorEngine();
let mascot = null;
let epoch = 0;
let speechEpoch = 0;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let speechRaf = 0;
let objectURL = null;
let downloadURL = null;
let lockedPack = [];
let packEpoch = 0;
let presentationMode = false;
let currentCustom = defaultQuestieCustomization('Pin');
let compileTimer = 0;
let runtimeFileCache = null;
let sdkBundleCache = null;

const audio = $('speech');
const report = (s) => { $('status').textContent = s; };

function syncPropUI(k, x) {
  const slider = $('prop-' + k);
  const out = $('prop-val-' + k);
  if (slider && document.activeElement !== slider) slider.value = String(x);
  if (out) out.textContent = Number(x).toFixed(2);
}

function activePresetName() {
  return $('character').value === 'questie-geo' ? 'Geo' : 'Pin';
}

// Stage backdrop control (shared between Studio header and Presentation HUD)
function setBackdrop(mode) {
  const valid = BACKDROPS.includes(mode) ? mode : 'dark';
  $('stage-frame').dataset.backdrop = valid;
  document.querySelectorAll('.backdrop-segment button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.backdrop === valid));
  });
  $('present-backdrop').textContent = BACKDROP_LABELS[valid];
}

document.querySelectorAll('.backdrop-segment button').forEach((btn) => {
  btn.onclick = () => setBackdrop(btn.dataset.backdrop);
});

$('present-backdrop').onclick = () => {
  const cur = $('stage-frame').dataset.backdrop || 'dark';
  const next = BACKDROPS[(BACKDROPS.indexOf(cur) + 1) % BACKDROPS.length];
  setBackdrop(next);
};

// Presentation Mode (immersive full-screen mascot showcase, iOS Safari & Desktop safe)
function setPresentationMode(active, { requestNativeFullscreen = false } = {}) {
  presentationMode = !!active;
  document.body.classList.toggle('presentation-mode', presentationMode);
  $('mode-studio').setAttribute('aria-pressed', String(!presentationMode));
  $('mode-present').setAttribute('aria-pressed', String(presentationMode));

  if (presentationMode && requestNativeFullscreen && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!presentationMode && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

$('mode-studio').onclick = () => setPresentationMode(false);
$('mode-present').onclick = () => setPresentationMode(true);
$('enter-present').onclick = () => setPresentationMode(true, { requestNativeFullscreen: true });
$('exit-present').onclick = () => setPresentationMode(false);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && presentationMode) {
    setPresentationMode(false);
  }
});

// Sync Presentation HUD character buttons
function syncPresentCharacterButtons() {
  const selected = $('character').value;
  document.querySelectorAll('[data-present-char]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.presentChar === selected));
  });
}

document.querySelectorAll('[data-present-char]').forEach((btn) => {
  btn.onclick = () => {
    const next = btn.dataset.presentChar;
    if ($('character').value !== next) {
      $('character').value = next;
      $('character').dispatchEvent(new Event('change'));
    }
  };
});

$('present-blink').onclick = () => (mascot ? mascot.triggerBlink(true) : behavior.triggerBlink(true));

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

// Build 12-state Reactive Behavior Grid (Studio) + Horizontal Touch Strip (Presentation Mode)
const behaviorGrid = $('behavior-grid');
const presentBehaviors = $('present-behaviors');
const behaviorButtons = new Map();
const presentBehaviorButtons = new Map();

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

  const pBtn = document.createElement('button');
  pBtn.type = 'button';
  pBtn.className = 'present-mood-btn';
  pBtn.dataset.stateId = st.id;
  pBtn.setAttribute('aria-pressed', String(st.id === behavior.state.id));
  pBtn.textContent = st.label;
  pBtn.onclick = () => selectBehavior(st.id);
  presentBehaviors.append(pBtn);
  presentBehaviorButtons.set(st.id, pBtn);
}

function syncBehaviorUI(stateObj) {
  $('behavior-mode-tag').textContent = stateObj.id;
  $('behavior-desc').textContent = stateObj.note;
  $('reaction').value = String(stateObj.emotion);
  for (const [id, btn] of behaviorButtons) {
    btn.setAttribute('aria-pressed', String(id === stateObj.id));
  }
  for (const [id, btn] of presentBehaviorButtons) {
    btn.setAttribute('aria-pressed', String(id === stateObj.id));
  }
}

function selectBehavior(id, { preserveAudio = false } = {}) {
  if (!preserveAudio) {
    const candidate = BEHAVIOR_STATES.find((s) => s.id === id);
    if (candidate && !candidate.verbal) stopSpeech(false);
  }
  if (mascot) {
    const st = mascot.setBehavior(id, { preserveAudio });
    syncBehaviorUI(st);
  } else {
    const st = behavior.setState(id);
    syncBehaviorUI(st);
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
      mascot?.setAutoLife(false);
    }
    if (['mouthOpen', 'mouthWide', 'teeth', 'tongue'].includes(k)) {
      mascot?.setManualMouthPinned(true);
    }
    const val = Number(slider.value);
    mascot?.setProperty(k, val, { immediate: true });
    syncPropUI(k, val);
  });
  row.append(head, slider);
  $('properties').append(row);
}

$('auto').onchange = () => {
  mascot?.setAutoLife($('auto').checked);
};

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

function stopSpeech(restoreBehavior = true) {
  speechEpoch++;
  window.speechSynthesis?.cancel();
  audio.pause();
  cancelAnimationFrame(speechRaf);
  mascot?.stopSpeaking({ restoreBehavior });
  if (restoreBehavior && mascot) {
    mascot.setProperty('emotion', Number($('reaction').value));
  }
}

$('locked-play').onclick = async () => {
  const character = $('character').value.split('-').at(-1);
  const line = lockedPack.find((x) => x.character === character && x.id === $('locked-line').value);
  if (!line || !mascot) return;
  stopSpeech(false);
  const token = ++speechEpoch;
  try {
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(line.file);
    audio.src = objectURL;
    audio.playbackRate = 1;
    await audio.play();
    if (token !== speechEpoch) return;
    await mascot.speakWithAudio(audio, line.cues, { switchBehavior: true });
    syncBehaviorUI(mascot.state);
    $('locked-status').textContent = line.text;
  } catch (e) {
    if (token === speechEpoch) {
      stopSpeech(true);
      $('locked-status').textContent = e.message;
    }
  }
};

// Update download link with current native .riv bytes (canonical or customized)
function updateDownloadLink(selectedId, bytes) {
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

// Live behavior dynamics sliders (immediate smooth spring response, no .riv recompile needed)
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

// Mount native Rive mascot via portable Questie Living Mascot SDK
async function load({ customBytes = null, preserveState = false } = {}) {
  const token = ++epoch;
  const previousValues = preserveState && mascot ? mascot.values : null;
  if (!preserveState) stopSpeech(false);
  mascot?.dispose();
  mascot = null;

  const selected = $('character').value;
  if (!['questie-pin', 'questie-geo'].includes(selected)) return;
  syncPresentCharacterButtons();
  report('Loading native Rive…');

  try {
    const mod = await import('./' + selected + '/index.js');
    if (token !== epoch) return;

    const bytesToLoad = customBytes ?? (await mod.loadFile());
    if (token !== epoch) return;

    const initialValues = previousValues ?? {
      ...defaults,
      ...viseme(Number($('mouth').value)),
      emotion: Number($('reaction').value),
    };

    const instance = await mountQuestieMascot({
      canvas: $('guide'),
      createPlayer: mod.createPlayer,
      bytes: bytesToLoad,
      stateMachine: 'Guide',
      behaviorEngine: behavior,
      initialValues,
      autoLife: $('auto').checked,
      interactiveGaze: true,
      paused,
      onPropertyChange: syncPropUI,
      onBehaviorChange: syncBehaviorUI,
    });

    if (token !== epoch) {
      instance.dispose();
      return;
    }

    mascot = instance;
    mascot.setProperty('emotion', Number($('reaction').value));

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
  syncPresentCharacterButtons();
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
  $('mouth').value = '0';
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
    mascot?.setProperty('emotion', idx);
  }
};

$('mouth').onchange = () => {
  stopSpeech(false);
  const idx = Number($('mouth').value);
  mascot?.setMouth(idx, { pin: idx !== 0 });
};

$('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
$('pause').onclick = () => {
  paused = !paused;
  paused ? mascot?.pause() : mascot?.play();
  $('pause').textContent = paused ? 'Resume motion' : 'Pause motion';
};

$('trigger-blink').onclick = () => {
  mascot ? mascot.triggerBlink(true) : behavior.triggerBlink(true);
};

// Speech & timed local recording controls
$('stop').onclick = () => stopSpeech(true);

$('speak').onclick = () => {
  stopSpeech(false);
  if (!mascot) return;
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
    if (token !== speechEpoch || !mascot) return;
    if (!started) started = ts;
    const i = Math.min(text.length - 1, offset + Math.floor((ts - started) / 95));
    mascot.setMouth(shape(text[i] || ''), { pin: false });
    speechRaf = requestAnimationFrame(tick);
  }
  u.onstart = () => {
    if (token !== speechEpoch || !mascot) return;
    selectBehavior('SPEAK-ATTEND', { preserveAudio: true });
    mascot.setSpeakingActive(true);
    speechRaf = requestAnimationFrame(tick);
  };
  u.onboundary = (e) => {
    offset = e.charIndex;
    started = performance.now();
  };
  u.onend = () => {
    if (token === speechEpoch) {
      cancelAnimationFrame(speechRaf);
      mascot?.stopSpeaking({ restoreBehavior: true });
    }
  };
  u.onerror = () => {
    if (token === speechEpoch) {
      cancelAnimationFrame(speechRaf);
      mascot?.stopSpeaking({ restoreBehavior: true });
      report('Browser speech could not play.');
    }
  };
  window.speechSynthesis.speak(u);
};

$('timed').onclick = async () => {
  stopSpeech(false);
  const token = ++speechEpoch;
  try {
    if (!mascot) throw Error('Load a character first');
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
    await mascot.speakWithAudio(audio, cues, { switchBehavior: true });
    syncBehaviorUI(mascot.state);
  } catch (e) {
    if (token === speechEpoch) {
      stopSpeech(true);
      report(e.message);
    }
  }
};

// Export complete standalone offline Rive bundle (.zip) INCLUDING portable Questie SDK + embed example
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

async function loadPortableSdkFiles() {
  if (sdkBundleCache) return sdkBundleCache;
  const names = [
    'questie-sdk.js',
    'questie-react.js',
    'questie-sdk.d.ts',
    'behavior-engine.js',
    'guide-contract.js',
    'locked-voice.js',
    'embed-example.html',
    'companion-demo.html',
  ];
  sdkBundleCache = await Promise.all(
    names.map(async (name) => {
      const res = await fetch('./' + name);
      if (!res.ok) throw new Error('Could not fetch SDK file ' + name);
      return { name, data: new Uint8Array(await res.arrayBuffer()) };
    }),
  );
  return sdkBundleCache;
}

$('export-zip').onclick = async () => {
  const btn = $('export-zip');
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Building .zip…';
  try {
    const [runtimeFiles, sdkFiles] = await Promise.all([
      loadVendoredRuntimeFiles(),
      loadPortableSdkFiles(),
    ]);
    const selected = $('character').value;
    const zipBytes = exportCustomBundleZip(selected, activePresetName(), currentCustom, runtimeFiles, sdkFiles);
    const url = URL.createObjectURL(new Blob([zipBytes], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected}-native-sdk-bundle.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    report(`Exported standalone Rive + SDK bundle (${(zipBytes.length / 1024 / 1024).toFixed(2)} MB)`);
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
    version: 'questie-phase5.2-recipe-1',
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
    syncPresentCharacterButtons();
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
  mascot?.dispose();
  mascot = null;
  if (objectURL) URL.revokeObjectURL(objectURL);
  if (downloadURL) URL.revokeObjectURL(downloadURL);
});

// Initialize studio
renderAppearancePresets();
syncCustomInputsFromState();
syncBehaviorUI(behavior.state);
syncPresentCharacterButtons();
setBackdrop('dark');
lockedOptions();
load();
