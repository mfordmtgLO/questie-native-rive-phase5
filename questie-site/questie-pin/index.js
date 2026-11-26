// index.js — standalone player for this Rive animation, exported from OpenRive.
//
//   import { mountPreview } from './index.js';   // the whole preview UI
//   import { createPlayer } from './index.js';   // just the canvas player
//
// Serve this folder over HTTP (see README.md); browsers refuse to load the
// runtime and the .riv file from file:// URLs.

export const manifest = {
  "name": "questie-pin",
  "file": "questie-pin.riv",
  "runtime": "offline",
  "runtimeBase": "./runtime/",
  "runtimeVersion": "vendored OpenRive runtime",
  "artboards": [
    {
      "name": "Pin",
      "width": 128,
      "height": 136,
      "stateMachines": [
        {
          "name": "Guide",
          "inputs": []
        }
      ],
      "timelines": [
        {
          "name": "Breathe",
          "fps": 60,
          "durationSeconds": 4
        },
        {
          "name": "Blink",
          "fps": 60,
          "durationSeconds": 4.6
        },
        {
          "name": "Viseme rest",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme MBP",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme AI",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme E",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme OU",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme FV",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme THL",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Viseme teeth",
          "fps": 60,
          "durationSeconds": 0.117
        },
        {
          "name": "Reaction ready",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction thinking",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction listening",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction favorite",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction pricedrop",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction newhome",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction traveling",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction arrived",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction achievement",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction guide",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction lookout",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction ponder",
          "fps": 60,
          "durationSeconds": 0.25
        },
        {
          "name": "Reaction speaking",
          "fps": 60,
          "durationSeconds": 0.25
        }
      ]
    }
  ]
};

let runtimePromise = null;

/** Loads the Rive WASM runtime (bundled under runtime/, or from the CDN). */
export function loadRuntime() {
  if (!runtimePromise) {
    const base = new URL(manifest.runtimeBase, import.meta.url).href;
    // the runtime asks for canvas_advanced.wasm; the package ships it as rive.wasm
    const locateFile = (file) => base + (file.endsWith('.wasm') ? 'rive.wasm' : file);
    runtimePromise = import(base + 'canvas_advanced.mjs').then((mod) => mod.default({ locateFile: locateFile }));
    runtimePromise.catch(() => {
      runtimePromise = null; // allow a retry
    });
  }
  return runtimePromise;
}

/** Reads the bundled .riv file. */
export async function loadFile() {
  const url = new URL(manifest.file, import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not read ' + manifest.file + ' (' + res.status + '). Serve this folder over HTTP — see README.md.');
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Plays the file on a canvas.
 *   artboard      index or name (default 0)
 *   stateMachine  index or name, -1 to run a timeline instead (default 0)
 *   timeline      index used when no state machine runs (default 0)
 *   mixAll        play every timeline at once
 *   onInputs / onProperties / onEvent   callbacks used by the controls
 */
export async function createPlayer(options) {
  const opts = options || {};
  const canvas = opts.canvas;
  if (!canvas) throw new Error('createPlayer needs a canvas');
  const rive = await loadRuntime();
  const bytes = opts.bytes || (await loadFile());
  const renderer = rive.makeRenderer(canvas);
  const file = await rive.load(bytes, undefined, false);

  let artboard = null;
  if (typeof opts.artboard === 'string') artboard = file.artboardByName(opts.artboard);
  if (!artboard) artboard = file.artboardByIndex(Math.min(Math.max(0, Number(opts.artboard) || 0), file.artboardCount() - 1));

  let sm = null;
  let anim = null;
  const extra = [];
  const wanted = opts.stateMachine === undefined ? 0 : opts.stateMachine;
  let smIndex = -1;
  if (typeof wanted === 'string') {
    for (let i = 0; i < artboard.stateMachineCount(); i++) {
      if (artboard.stateMachineByIndex(i).name === wanted) smIndex = i;
    }
  } else smIndex = Number(wanted);
  if (smIndex >= 0 && artboard.stateMachineCount() > smIndex) {
    sm = new rive.StateMachineInstance(artboard.stateMachineByIndex(smIndex), artboard);
  } else if (artboard.animationCount() > 0) {
    const first = Math.min(Math.max(0, Number(opts.timeline) || 0), artboard.animationCount() - 1);
    anim = new rive.LinearAnimationInstance(artboard.animationByIndex(first), artboard);
    if (opts.mixAll) {
      for (let i = 0; i < artboard.animationCount(); i++) {
        if (i !== first) extra.push(new rive.LinearAnimationInstance(artboard.animationByIndex(i), artboard));
      }
    }
  }

  // Files that use data binding need their default view model instance bound,
  // otherwise bound properties (and anything driven by them) stay static.
  let vmi = null;
  let viewModel = null;
  try {
    const vm = file.viewModelCount() > 0 ? file.defaultArtboardViewModel(artboard) : null;
    if (vm) {
      viewModel = vm.name;
      vmi = vm.defaultInstance() || vm.instance();
      if (vmi) {
        if (sm) sm.bindViewModelInstance(vmi);
        else artboard.bindViewModelInstance(vmi);
      }
    }
  } catch (e) {
    vmi = null;
  }

  const readInputs = () => {
    const out = [];
    if (!sm) return out;
    for (let i = 0; i < sm.inputCount(); i++) {
      const input = sm.input(i);
      const type = input.type === rive.SMIInput.bool ? 'bool' : input.type === rive.SMIInput.number ? 'number' : 'trigger';
      out.push({ name: input.name, type: type, value: type === 'trigger' ? false : input.value });
    }
    return out;
  };

  const readProperties = () => {
    const out = [];
    if (!vmi) return out;
    for (const p of vmi.getProperties()) {
      const t = String(p.type);
      let value = null;
      let values = undefined;
      try {
        if (t === 'number' || t === 'integer') value = vmi.number(p.name).value;
        else if (t === 'boolean') value = vmi.boolean(p.name).value;
        else if (t === 'string') value = vmi.string(p.name).value;
        else if (t === 'color') value = vmi.color(p.name).value;
        else if (t === 'enumType') {
          const e = vmi.enum(p.name);
          value = e.value;
          values = e.values;
        }
      } catch (e) {
        value = null;
      }
      out.push({ name: p.name, type: t, value: value, options: values });
    }
    return out;
  };

  // layout: contain + center, like the OpenRive preview
  const layout = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const b = artboard.bounds;
    const aw = b.maxX - b.minX;
    const ah = b.maxY - b.minY;
    const scale = Math.min(w / aw, h / ah);
    return { scale: scale, ox: (w - aw * scale) / 2, oy: (h - ah * scale) / 2, dpr: dpr };
  };

  const toArtboard = (e) => {
    const r = canvas.getBoundingClientRect();
    const l = layout();
    return [((e.clientX - r.left) * l.dpr - l.ox) / l.scale, ((e.clientY - r.top) * l.dpr - l.oy) / l.scale];
  };
  const point = (fn) => (e) => {
    if (!sm) return;
    const p = toArtboard(e);
    fn(p[0], p[1]);
  };
  const down = point((x, y) => sm.pointerDown(x, y, 0));
  const move = point((x, y) => sm.pointerMove(x, y, 0));
  const up = point((x, y) => sm.pointerUp(x, y, 0));
  const leave = point((x, y) => sm.pointerExit(x, y, 0));
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave', leave);

  let disposed = false;
  let paused = !!opts.paused;
  let raf = 0;
  let last = 0;
  let poll = 0;
  const frame = (t) => {
    if (disposed) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    const step = paused ? 0 : dt;
    if (sm) {
      sm.advanceAndApply(step);
      const n = sm.reportedEventCount();
      for (let i = 0; i < n; i++) {
        const ev = sm.reportedEventAt(i);
        if (ev && opts.onEvent) opts.onEvent(ev.name);
      }
      if (++poll % 10 === 0) {
        if (opts.onInputs) opts.onInputs(readInputs());
        if (opts.onProperties) opts.onProperties(readProperties(), viewModel);
      }
    } else if (anim) {
      anim.advance(step);
      anim.apply(1);
      for (const a of extra) {
        a.advance(step);
        a.apply(1);
      }
      artboard.advance(step);
    } else {
      artboard.advance(step);
    }
    const l = layout();
    renderer.clear();
    renderer.save();
    renderer.transform(l.scale, 0, 0, l.scale, l.ox, l.oy);
    artboard.draw(renderer);
    renderer.restore();
    raf = rive.requestAnimationFrame(frame);
  };
  raf = rive.requestAnimationFrame(frame);

  if (opts.onInputs) opts.onInputs(readInputs());
  if (opts.onProperties) opts.onProperties(readProperties(), viewModel);

  return {
    canvas: canvas,
    artboard: artboard,
    viewModel: viewModel,
    inputs: readInputs,
    properties: readProperties,
    setInput: function (name, value) {
      if (!sm) return;
      for (let i = 0; i < sm.inputCount(); i++) {
        const input = sm.input(i);
        if (input.name !== name) continue;
        if (input.type === rive.SMIInput.trigger) input.asTrigger().fire();
        else if (input.type === rive.SMIInput.bool) input.asBool().value = !!value;
        else input.asNumber().value = Number(value);
      }
      if (opts.onInputs) opts.onInputs(readInputs());
    },
    setProperty: function (name, type, value) {
      if (!vmi) return;
      try {
        if (type === 'number' || type === 'integer') vmi.number(name).value = Number(value);
        else if (type === 'boolean') vmi.boolean(name).value = !!value;
        else if (type === 'string') vmi.string(name).value = String(value);
        else if (type === 'color') vmi.color(name).value = Number(value) | 0;
        else if (type === 'enumType') vmi.enum(name).value = String(value);
        else if (type === 'trigger') vmi.trigger(name).trigger();
      } catch (e) {
        /* unsupported property */
      }
      if (opts.onProperties) opts.onProperties(readProperties(), viewModel);
    },
    pause: function () {
      paused = true;
    },
    play: function () {
      paused = false;
    },
    dispose: function () {
      disposed = true;
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointerleave', leave);
      rive.cancelAnimationFrame(raf);
      if (sm) sm.delete();
      if (anim) anim.delete();
      for (const a of extra) a.delete();
      if (vmi && vmi.unref) vmi.unref();
      if (renderer.delete) renderer.delete();
      artboard.delete();
      if (file.unref) file.unref();
    },
  };
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const option = (label, value) => {
  const o = document.createElement('option');
  o.textContent = label;
  o.value = String(value);
  return o;
};

/**
 * Renders the whole preview — artboard / state machine pickers, inputs, data
 * bound properties and the event log — into an element. Needs styles.css.
 */
export async function mountPreview(root, options) {
  const opts = options || {};
  if (!manifest.artboards.length) return null;
  const state = {
    artboard: 0,
    stateMachine: 0,
    timeline: 0,
    mixAll: !manifest.artboards[0].stateMachines.length,
    background: opts.background || 'dark',
  };

  const bar = el('div', 'or-bar');
  const artboardSel = el('select', 'or-field');
  const smSel = el('select', 'or-field');
  const timelineSel = el('select', 'or-field');
  const bgSel = el('select', 'or-field');
  const restart = el('button', 'or-btn', 'Restart');
  bgSel.append(option('Dark', 'dark'), option('Light', 'light'), option('Transparent', 'checker'));
  bgSel.value = state.background;
  bar.append(el('span', 'or-title', manifest.name), artboardSel, smSel, timelineSel, el('span', 'or-spacer'), bgSel, restart);

  const stage = el('div', 'or-stage or-bg-' + state.background);
  const canvas = el('canvas', 'or-canvas');
  const message = el('div', 'or-message');
  stage.append(canvas, message);
  const side = el('aside', 'or-side');
  const body = el('div', 'or-body');
  body.append(stage, side);
  root.classList.add('or-root');
  root.append(bar, body);

  const fillArtboards = () => {
    artboardSel.textContent = '';
    manifest.artboards.forEach((a, i) => artboardSel.append(option(a.name, i)));
    artboardSel.value = String(state.artboard);
    artboardSel.style.display = manifest.artboards.length > 1 ? '' : 'none';
  };

  const fillScenes = () => {
    const ab = manifest.artboards[state.artboard];
    smSel.textContent = '';
    ab.stateMachines.forEach((m, i) => smSel.append(option(m.name, i)));
    smSel.append(option('Timeline only', -1));
    smSel.value = String(ab.stateMachines.length && !state.mixAll ? state.stateMachine : -1);
    smSel.style.display = ab.stateMachines.length ? '' : 'none';
    timelineSel.textContent = '';
    timelineSel.append(option('All timelines', -1));
    ab.timelines.forEach((t, i) => timelineSel.append(option(t.name, i)));
    timelineSel.value = String(state.mixAll ? -1 : state.timeline);
    const usingTimeline = !ab.stateMachines.length || Number(smSel.value) < 0;
    timelineSel.style.display = usingTimeline && ab.timelines.length ? '' : 'none';
  };

  let player = null;
  let inputs = [];
  let properties = [];
  let viewModel = null;
  let events = [];

  const inputRow = (input) => {
    const row = el('div', 'or-row');
    row.append(el('span', 'or-name', input.name));
    if (input.type === 'trigger') {
      const b = el('button', 'or-btn', 'Fire');
      b.onclick = () => player && player.setInput(input.name, true);
      row.append(b);
    } else if (input.type === 'bool') {
      const c = el('input', 'or-check');
      c.type = 'checkbox';
      c.checked = !!input.value;
      c.onchange = () => player && player.setInput(input.name, c.checked);
      row.append(c);
    } else {
      const n = el('input', 'or-field or-num');
      n.type = 'number';
      n.value = String(input.value);
      n.oninput = () => player && player.setInput(input.name, Number(n.value));
      row.append(n);
    }
    return row;
  };

  const propertyRow = (p) => {
    const row = el('div', 'or-row');
    row.append(el('span', 'or-name', p.name));
    const set = (v) => player && player.setProperty(p.name, p.type, v);
    if (p.type === 'number' || p.type === 'integer') {
      const n = el('input', 'or-field or-num');
      n.type = 'number';
      n.value = String(p.value === null ? 0 : p.value);
      n.oninput = () => set(Number(n.value));
      row.append(n);
    } else if (p.type === 'boolean') {
      const c = el('input', 'or-check');
      c.type = 'checkbox';
      c.checked = !!p.value;
      c.onchange = () => set(c.checked);
      row.append(c);
    } else if (p.type === 'string') {
      const t = el('input', 'or-field');
      t.value = p.value === null ? '' : String(p.value);
      t.oninput = () => set(t.value);
      row.append(t);
    } else if (p.type === 'color') {
      const c = el('input', 'or-color');
      c.type = 'color';
      c.value = '#' + ((Number(p.value || 0) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
      c.oninput = () => set((0xff000000 | parseInt(c.value.slice(1), 16)) | 0);
      row.append(c);
    } else if (p.type === 'enumType') {
      const s = el('select', 'or-field');
      for (const o of p.options || []) s.append(option(o, o));
      s.value = String(p.value);
      s.onchange = () => set(s.value);
      row.append(s);
    } else if (p.type === 'trigger') {
      const b = el('button', 'or-btn', 'Fire');
      b.onclick = () => set(true);
      row.append(b);
    } else row.append(el('span', 'or-type', p.type));
    return row;
  };

  const renderSide = () => {
    side.textContent = '';
    if (properties.length) {
      side.append(el('div', 'or-label', 'View model' + (viewModel ? ' · ' + viewModel : '')));
      for (const p of properties) side.append(propertyRow(p));
    }
    if (inputs.length) {
      side.append(el('div', 'or-label', 'Inputs'));
      for (const i of inputs) side.append(inputRow(i));
    }
    if (events.length) {
      side.append(el('div', 'or-label', 'Events'));
      for (const e of events) side.append(el('div', 'or-event', e));
    }
    side.style.display = side.childNodes.length ? '' : 'none';
  };

  const start = async () => {
    if (player) player.dispose();
    player = null;
    inputs = [];
    properties = [];
    events = [];
    message.textContent = '';
    renderSide();
    try {
      player = await createPlayer({
        canvas: canvas,
        artboard: state.artboard,
        stateMachine: manifest.artboards[state.artboard].stateMachines.length && !state.mixAll ? state.stateMachine : -1,
        timeline: state.timeline,
        mixAll: state.mixAll,
        onInputs: (v) => {
          inputs = v;
          renderSide();
        },
        onProperties: (v, name) => {
          properties = v;
          viewModel = name;
          renderSide();
        },
        onEvent: (name) => {
          events = [new Date().toLocaleTimeString() + '  ' + name].concat(events).slice(0, 30);
          renderSide();
        },
      });
    } catch (e) {
      message.textContent = (e && e.message) || String(e);
    }
  };

  artboardSel.onchange = () => {
    state.artboard = Number(artboardSel.value);
    state.stateMachine = 0;
    state.timeline = 0;
    state.mixAll = !manifest.artboards[state.artboard].stateMachines.length;
    fillScenes();
    start();
  };
  smSel.onchange = () => {
    const v = Number(smSel.value);
    state.mixAll = v < 0;
    if (v >= 0) state.stateMachine = v;
    fillScenes();
    start();
  };
  timelineSel.onchange = () => {
    const v = Number(timelineSel.value);
    state.mixAll = v < 0;
    state.timeline = Math.max(0, v);
    start();
  };
  bgSel.onchange = () => {
    stage.className = 'or-stage or-bg-' + bgSel.value;
  };
  restart.onclick = () => start();

  fillArtboards();
  fillScenes();
  renderSide();
  await start();
  return { restart: start, player: () => player };
}
