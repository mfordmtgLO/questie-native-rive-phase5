// Questie Portable Living Mascot SDK — Phase 5.2
// Reusable, zero-dependency browser SDK for embedding native OpenRive Pin & Geo .riv mascots
// in any web application while preserving full autonomous life, articulated gestures, laptop
// interaction, pointer/touch gaze anticipation, and audio-clock continuous lip-sync.
//
// Usage:
//   import { createPlayer } from './questie-pin/index.js';
//   import { mountQuestieMascot } from './questie-sdk.js';
//
//   const mascot = await mountQuestieMascot({
//     canvas: document.getElementById('mascot'),
//     createPlayer,
//     initialBehavior: 'IDLE-PARKED',
//   });
//   mascot.setBehavior('WORK-THINK');
//   mascot.triggerBlink(true);
//   mascot.dispose();

import { limits, defaults, viseme, clamp, sampleCues } from './guide-contract.js';
import { BEHAVIOR_STATES, BEHAVIOR_BY_ID, behaviorForEmotion, createBehaviorEngine } from './behavior-engine.js';

export { BEHAVIOR_STATES, BEHAVIOR_BY_ID, behaviorForEmotion, limits, defaults, viseme, sampleCues };

const CONTINUOUS_KEYS = Object.keys(limits).filter((k) => !['emotion', 'mouthShape'].includes(k));

function stepCriticallyDamped(pos, vel, goal, omega, dt) {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const nextPos = (f * pos + dt * vel + hhoo * goal) * detInv;
  const nextVel = (vel + hoo * (goal - pos)) * detInv;
  return [nextPos, nextVel];
}

/**
 * Mounts a native Questie .riv mascot onto a <canvas> with portable host orchestration.
 * Native .riv layers (Idle breathing, AutoBlink, AutoGaze, 13 articulated Emotion performances)
 * run inside the Rive WASM runtime; this SDK adds pointer/touch gaze anticipation, spring
 * smoothing, behavior selection, and audio-clock mouth sync without duplicating native motion.
 */
export async function mountQuestieMascot(options) {
  const opts = options || {};
  const canvas = opts.canvas;
  if (!canvas) throw new Error('mountQuestieMascot requires a canvas element');
  if (typeof opts.createPlayer !== 'function') {
    throw new Error('mountQuestieMascot requires a createPlayer function from the exported Rive bundle');
  }

  let bytes = opts.bytes || null;
  if (!bytes && opts.rivUrl) {
    const res = await fetch(opts.rivUrl);
    if (!res.ok) throw new Error(`Could not fetch mascot .riv (${res.status})`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }

  const stateMachine = opts.stateMachine ?? 'Guide';
  let explicitPaused = !!opts.paused;
  let offscreenSuspended = false;
  let hiddenSuspended = typeof document !== 'undefined' && document.hidden;
  let autoLife = opts.autoLife !== false;
  const interactiveGaze = opts.interactiveGaze !== false;
  const pauseWhenOffscreen = opts.pauseWhenOffscreen !== false;
  const respectReducedMotion = opts.respectReducedMotion !== false;

  const isEffectivelyPaused = () => explicitPaused || (pauseWhenOffscreen && (offscreenSuspended || hiddenSuspended));
  let paused = isEffectivelyPaused();

  const player = await opts.createPlayer({
    canvas,
    bytes: bytes || undefined,
    artboard: opts.artboard,
    stateMachine,
    paused,
  });

  const propNames = player.properties().map((p) => p.name);
  if (!Object.keys(limits).every((k) => propNames.includes(k)) || propNames.length !== 13) {
    player.dispose();
    throw new Error(`Native GuideVM contract missing (expected 13 properties, found ${propNames.length})`);
  }

  const behavior = opts.behaviorEngine || createBehaviorEngine();
  if (opts.initialBehavior && BEHAVIOR_BY_ID[opts.initialBehavior]) {
    behavior.setState(opts.initialBehavior);
  }

  const values = { ...defaults, ...(opts.initialValues || {}) };
  const target = { ...values };
  const springVel = { lookX: 0, lookY: 0, headX: 0, headY: 0, breath: 0 };

  let activeSpeaking = false;
  let activeProcessing = false;
  let manualMouthPinned = false;
  let speechRaf = 0;
  let speechToken = 0;
  let activeAudio = null;
  let disposed = false;
  let lastTapAt = 0;
  let touchReleaseTimer = 0;
  let laptopMode = 'auto';
  let armGesture = 'auto';
  let headphonesMode = 'auto';

  const LAPTOP_MODES = { auto: 0, closed: 1, open: 2 };
  const ARM_GESTURES = { auto: 0, wave: 1, typing: 2, ponder: 3, present: 4, celebrate: 5 };
  const HEADPHONES_MODES = { auto: 0, off: 1, on: 2 };

  function syncPauseState() {
    const next = isEffectivelyPaused();
    if (next === paused) return;
    paused = next;
    if (paused) {
      player.pause();
    } else {
      lastFrame = 0;
      player.play();
    }
  }

  // Respect OS prefers-reduced-motion preference dynamically
  let reducedMotionQuery = null;
  const applyReducedMotion = (matches) => {
    behavior.dynamics.reducedMotion = respectReducedMotion && !!matches;
  };
  if (respectReducedMotion && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    applyReducedMotion(reducedMotionQuery.matches);
  }
  const onReducedMotionChange = (ev) => applyReducedMotion(ev.matches);
  reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange);

  // Auto-suspend rendering when scrolled offscreen or tab hidden
  let intersectionObserver = null;
  if (pauseWhenOffscreen && typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        offscreenSuspended = !entry.isIntersecting;
        syncPauseState();
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(canvas);
  }
  const onVisibilityChange = () => {
    hiddenSuspended = document.hidden;
    syncPauseState();
  };
  if (pauseWhenOffscreen && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function emitProperty(k, val) {
    if (typeof opts.onPropertyChange === 'function') {
      opts.onPropertyChange(k, val);
    }
  }

  function setProperty(k, v, { immediate = true } = {}) {
    const x = clamp(k, v);
    if (immediate) {
      target[k] = x;
      if (k in springVel) springVel[k] = 0;
    }
    if (!disposed && values[k] !== x) {
      player.setProperty(k, 'number', x);
    }
    values[k] = x;
    emitProperty(k, x);
    return x;
  }

  function applyProperties(obj, { immediate = true } = {}) {
    for (const [k, v] of Object.entries(obj)) {
      setProperty(k, v, { immediate });
    }
  }

  // Push initial GuideVM state synchronously
  for (const [k, v] of Object.entries(target)) {
    const x = clamp(k, v);
    player.setProperty(k, 'number', x);
    values[k] = x;
    emitProperty(k, x);
  }
  setProperty('emotion', behavior.state.emotion);

  function setBehavior(id, { preserveAudio = false } = {}) {
    const st = behavior.setState(id);
    if (!preserveAudio && !st.verbal) {
      stopSpeaking({ restoreBehavior: false });
    }
    setProperty('emotion', st.emotion);
    if (!activeSpeaking) {
      target.speaking = 0;
      setProperty('speaking', 0);
    }
    if (typeof opts.onBehaviorChange === 'function') {
      opts.onBehaviorChange(st);
    }
    return st;
  }

  function setReaction(index) {
    const idx = clamp('emotion', Number(index));
    const matched = behaviorForEmotion(idx);
    if (matched && matched.emotion === idx) {
      return setBehavior(matched.id);
    }
    stopSpeaking({ restoreBehavior: false });
    setProperty('emotion', idx);
    return null;
  }

  function setMouth(visemeIndex, { pin = true } = {}) {
    const idx = clamp('mouthShape', Number(visemeIndex));
    manualMouthPinned = pin && idx !== 0;
    Object.assign(target, viseme(idx));
    if (paused) applyProperties(target);
  }

  function setMouthValues(mouthObj, { pin = true } = {}) {
    manualMouthPinned = pin;
    Object.assign(target, mouthObj);
    if (paused) applyProperties(mouthObj);
  }

  function resetSpeechState(restoreBehavior = true) {
    activeSpeaking = false;
    manualMouthPinned = false;
    Object.assign(target, viseme(0));
    target.speaking = 0;
    applyProperties({ ...viseme(0), speaking: 0 });
    if (restoreBehavior) {
      setProperty('emotion', behavior.state.emotion);
    }
  }

  function stopSpeaking({ restoreBehavior = true } = {}) {
    speechToken++;
    cancelAnimationFrame(speechRaf);
    speechRaf = 0;
    if (activeAudio) {
      try {
        activeAudio.pause();
      } catch {
        // ignore audio pause errors on detached elements
      }
      activeAudio = null;
    }
    resetSpeechState(restoreBehavior);
  }

  /**
   * Drives continuous mouth opening, width, teeth, and tongue directly from an HTMLAudioElement
   * playback clock and ordered viseme cues without interrupting blinking, breathing, or gaze.
   */
  async function speakWithAudio(audioEl, cues, { switchBehavior = true, onEnd } = {}) {
    stopSpeaking({ restoreBehavior: false });
    const token = ++speechToken;
    activeAudio = audioEl;
    if (switchBehavior) {
      setBehavior('SPEAK-ATTEND', { preserveAudio: true });
    }
    activeSpeaking = true;
    manualMouthPinned = false;
    target.speaking = 1;

    function tick() {
      if (disposed || token !== speechToken) return;
      if (audioEl.ended) {
        activeAudio = null;
        resetSpeechState(true);
        if (typeof onEnd === 'function') onEnd();
        return;
      }
      const playing = !audioEl.paused;
      Object.assign(target, playing ? sampleCues(cues, audioEl.currentTime) : viseme(0));
      target.speaking = playing ? 1 : 0;
      activeSpeaking = playing;
      speechRaf = requestAnimationFrame(tick);
    }
    speechRaf = requestAnimationFrame(tick);
  }

  /**
   * Drives continuous viseme mouth deformation from ordered cues on a monotonic animation clock.
   * Useful for synchronized speech previews when an external audio element is not attached.
   */
  function speakWithCues(cues, { duration, switchBehavior = true, onEnd } = {}) {
    stopSpeaking({ restoreBehavior: false });
    const token = ++speechToken;
    const total = Number.isFinite(duration) && duration > 0
      ? duration
      : (cues?.length ? cues[cues.length - 1].time + 0.15 : 0);
    if (!cues?.length || total <= 0) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }
    if (switchBehavior) {
      setBehavior('SPEAK-ATTEND', { preserveAudio: true });
    }
    activeSpeaking = true;
    manualMouthPinned = false;
    target.speaking = 1;
    const startedAt = performance.now();

    function tick(now) {
      if (disposed || token !== speechToken) return;
      const elapsedSec = (now - startedAt) / 1000;
      if (elapsedSec >= total) {
        resetSpeechState(true);
        if (typeof onEnd === 'function') onEnd();
        return;
      }
      Object.assign(target, sampleCues(cues, elapsedSec));
      target.speaking = 1;
      activeSpeaking = true;
      speechRaf = requestAnimationFrame(tick);
    }
    speechRaf = requestAnimationFrame(tick);
  }

  /**
   * Backward-compatible native accessory control (`laptopMode` input on Guide state machine).
   * Preserves exact 13-property GuideVM interface.
   */
  function setLaptopMode(mode = 'auto') {
    const key = typeof mode === 'number'
      ? (Object.keys(LAPTOP_MODES).find((k) => LAPTOP_MODES[k] === mode) || 'auto')
      : String(mode || 'auto').toLowerCase();
    const val = LAPTOP_MODES[key] ?? 0;
    laptopMode = key in LAPTOP_MODES ? key : 'auto';
    if (!disposed && typeof player.setInput === 'function') {
      player.setInput('laptopMode', val);
    }
    return laptopMode;
  }

  /**
   * Backward-compatible native articulated arm/hand gesture override (`armGesture` input on Guide).
   * Preserves exact 13-property GuideVM interface.
   */
  function setArmGesture(gesture = 'auto') {
    const key = typeof gesture === 'number'
      ? (Object.keys(ARM_GESTURES).find((k) => ARM_GESTURES[k] === gesture) || 'auto')
      : String(gesture || 'auto').toLowerCase();
    const val = ARM_GESTURES[key] ?? 0;
    armGesture = key in ARM_GESTURES ? key : 'auto';
    if (!disposed && typeof player.setInput === 'function') {
      player.setInput('armGesture', val);
    }
    return armGesture;
  }

  /**
   * Backward-compatible native over-ear working headphones override (`headphonesMode` input on Guide).
   * Preserves exact 13-property GuideVM interface.
   */
  function setHeadphonesMode(mode = 'auto') {
    const key = typeof mode === 'number'
      ? (Object.keys(HEADPHONES_MODES).find((k) => HEADPHONES_MODES[k] === mode) || 'auto')
      : String(mode || 'auto').toLowerCase();
    const val = HEADPHONES_MODES[key] ?? 0;
    headphonesMode = key in HEADPHONES_MODES ? key : 'auto';
    if (!disposed && typeof player.setInput === 'function') {
      player.setInput('headphonesMode', val);
    }
    return headphonesMode;
  }

  /**
   * Application processing lifecycle:
   * - `setProcessing(true)`: keeps the mascot actively working at its open laptop (`WORK-THINK`).
   * - `setProcessing(false, completionBehavior)`: smoothly finishes typing and transitions into the reaction.
   */
  function setProcessing(active, completionBehavior = 'ARRIVED') {
    activeProcessing = !!active;
    if (activeProcessing) {
      setBehavior('WORK-THINK', { preserveAudio: true });
      behavior.setPointer(0, 0.34, true);
    } else if (completionBehavior && BEHAVIOR_BY_ID[completionBehavior]) {
      behavior.setPointer(0.06, -0.04, true);
      setBehavior(completionBehavior, { preserveAudio: true });
    }
    return activeProcessing;
  }

  // Pointer & touch gaze anticipation handlers
  function updatePointerFromEvent(e) {
    const b = canvas.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const norm = (v) => Math.max(-1, Math.min(1, v * 2 - 1));
    behavior.setPointer(norm((e.clientX - b.left) / b.width), norm((e.clientY - b.top) / b.height), true);
  }

  const onPointerDown = (e) => {
    clearTimeout(touchReleaseTimer);
    updatePointerFromEvent(e);
    const now = performance.now();
    if (now - lastTapAt < 340) {
      behavior.triggerBlink(true);
    }
    lastTapAt = now;
  };

  const onPointerMove = (e) => {
    if (e.pointerType === 'mouse' || e.buttons > 0) {
      clearTimeout(touchReleaseTimer);
      updatePointerFromEvent(e);
    }
  };

  const onPointerUp = (e) => {
    if (e.pointerType !== 'mouse') {
      clearTimeout(touchReleaseTimer);
      touchReleaseTimer = setTimeout(() => behavior.setPointer(0, 0, false), 1600);
    }
  };

  const onPointerLeave = () => {
    behavior.setPointer(0, 0, false);
  };

  if (interactiveGaze) {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
  }

  // Main critically damped orchestration loop
  let rafId = 0;
  let lastFrame = 0;

  function stepFrame(t) {
    if (disposed) return;
    const dt = lastFrame ? Math.min(0.05, (t - lastFrame) / 1000) : 0;
    lastFrame = t;

    if (!paused) {
      let eyeOmega = 11.5;
      let headOmega = 3.4;
      let breathOmega = 3.2;
      let microWide = 0;
      let microOpen = 0;

      if (autoLife) {
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
        eyeOmega = frame.eyeOmega;
        headOmega = frame.headOmega;
        breathOmega = frame.breathOmega;

        if (!activeSpeaking && !manualMouthPinned && target.mouthShape === 0) {
          microWide = frame.microSmileWide;
          microOpen = frame.microSmileOpen;
        }
      }

      for (const k of CONTINUOUS_KEYS) {
        if (k === 'lookX' || k === 'lookY' || k === 'headX' || k === 'headY' || k === 'breath') {
          const omega = k === 'breath' ? breathOmega : k === 'lookX' || k === 'lookY' ? eyeOmega : headOmega;
          const [nextPos, nextVel] = stepCriticallyDamped(values[k], springVel[k], target[k], omega, dt);
          springVel[k] = nextVel;
          if (Math.abs(target[k] - nextPos) > 1e-5 || Math.abs(nextVel) > 1e-4) {
            setProperty(k, nextPos, { immediate: false });
          } else {
            springVel[k] = 0;
            setProperty(k, target[k], { immediate: false });
          }
          continue;
        }

        let goal = target[k];
        if (k === 'mouthWide') goal = clamp('mouthWide', goal + microWide);
        if (k === 'mouthOpen') goal = clamp('mouthOpen', goal + microOpen);

        let speed = 10;
        if (['mouthOpen', 'mouthWide', 'teeth', 'tongue'].includes(k)) speed = activeSpeaking ? 32 : 8.5;
        else if (k === 'blink') speed = 46;
        else if (k === 'speaking') speed = 9;

        const delta = goal - values[k];
        if (Math.abs(delta) > 1e-5) {
          setProperty(k, values[k] + delta * (1 - Math.exp(-dt * speed)), { immediate: false });
        } else {
          setProperty(k, goal, { immediate: false });
        }
      }
      setProperty('mouthShape', target.mouthShape, { immediate: false });
    }
    rafId = requestAnimationFrame(stepFrame);
  }
  rafId = requestAnimationFrame(stepFrame);

  const cleanups = [];

  /**
   * Synchronizes the mascot's gaze and typing posture with live user keystrokes.
   * cursorRatio (0..1) gently guides horizontal eye reading across the active text input.
   */
  function notifyTypingActivity(cursorRatio = 0.5, { behaviorId = 'WORK-THINK' } = {}) {
    if (disposed) return;
    if (behavior.state.id !== behaviorId && !activeSpeaking) {
      setBehavior(behaviorId, { preserveAudio: true });
    }
    const clampedRatio = Math.max(0, Math.min(1, Number(cursorRatio) || 0.5));
    const lookX = (clampedRatio - 0.5) * 0.72;
    behavior.setPointer(lookX, 0.3, true);
  }

  /**
   * Binds the mascot beside any HTMLInputElement, HTMLTextAreaElement, or contenteditable box.
   * - Focus (empty): TYPE-LISTEN (warm attentive posture looking toward input)
   * - Active keystrokes: WORK-THINK (miniature laptop opens, articulated fingers type in sync)
   * - Brief typing pause with text (~1.1s): TYPE-PONDER (right hand/finger to chin over laptop)
   * - Submit (Enter or form submit): reactive milestone/acknowledgment, then serene settle
   * - Blur / idle: graceful return to IDLE-PARKED
   */
  function attachInput(inputEl, config = {}) {
    if (!inputEl) throw new Error('attachInput requires an input or textarea element');
    const {
      typingBehavior = 'WORK-THINK',
      pauseBehavior = 'TYPE-PONDER',
      listenBehavior = 'TYPE-LISTEN',
      idleBehavior = 'IDLE-PARKED',
      submitBehavior = 'ARRIVED',
      pauseMs = 1150,
      idleMs = 3400,
      submitHoldMs = 2400,
      resolveSubmitBehavior,
      onActivity,
    } = config;

    let pauseTimer = 0;
    let idleTimer = 0;
    let submitTimer = 0;

    const readText = () =>
      typeof inputEl.value === 'string' ? inputEl.value : String(inputEl.textContent || '');

    const cursorRatio = () => {
      const text = readText();
      if (!text.length) return 0.35;
      const pos = typeof inputEl.selectionStart === 'number' ? inputEl.selectionStart : text.length;
      return Math.max(0.1, Math.min(0.9, pos / Math.max(24, text.length)));
    };

    const clearTimers = () => {
      clearTimeout(pauseTimer);
      clearTimeout(idleTimer);
      clearTimeout(submitTimer);
    };

    const emitActivity = (phase, stateId) => {
      if (typeof onActivity === 'function') onActivity({ phase, behavior: stateId, text: readText() });
    };

    const onFocus = () => {
      clearTimers();
      if (activeSpeaking) return;
      const hasText = readText().trim().length > 0;
      const next = hasText ? pauseBehavior : listenBehavior;
      setBehavior(next, { preserveAudio: true });
      behavior.setPointer(0.32, 0.22, true);
      emitActivity('focus', next);
    };

    const onInput = () => {
      clearTimers();
      if (activeSpeaking) return;
      const text = readText().trim();
      if (!text.length) {
        setBehavior(listenBehavior, { preserveAudio: true });
        behavior.setPointer(0.28, 0.2, true);
        emitActivity('cleared', listenBehavior);
        return;
      }
      notifyTypingActivity(cursorRatio(), { behaviorId: typingBehavior });
      emitActivity('typing', typingBehavior);

      pauseTimer = setTimeout(() => {
        if (disposed || activeSpeaking) return;
        if (readText().trim().length > 0) {
          setBehavior(pauseBehavior, { preserveAudio: true });
          behavior.setPointer(0.24, -0.18, true);
          emitActivity('ponder', pauseBehavior);
        }
      }, pauseMs);

      idleTimer = setTimeout(() => {
        if (disposed || activeSpeaking) return;
        if (document.activeElement !== inputEl && !readText().trim().length) {
          behavior.setPointer(0, 0, false);
          setBehavior(idleBehavior, { preserveAudio: true });
          emitActivity('idle', idleBehavior);
        }
      }, idleMs);
    };

    const triggerSubmit = (submittedText) => {
      clearTimers();
      if (activeSpeaking) return;
      const resolved =
        typeof resolveSubmitBehavior === 'function'
          ? resolveSubmitBehavior(submittedText) || submitBehavior
          : submitBehavior;

      const finishSubmit = (finalBehavior) => {
        if (disposed || activeSpeaking) return;
        activeProcessing = false;
        setBehavior(finalBehavior || resolved, { preserveAudio: true });
        behavior.setPointer(0.08, -0.04, true);
        emitActivity('submit', finalBehavior || resolved);
        submitTimer = setTimeout(() => {
          if (disposed || activeSpeaking || activeProcessing) return;
          behavior.setPointer(0, 0, false);
          const focused = document.activeElement === inputEl;
          const settled = focused ? listenBehavior : idleBehavior;
          setBehavior(settled, { preserveAudio: true });
          emitActivity(focused ? 'listen' : 'idle', settled);
        }, submitHoldMs);
      };

      const processingMs = Number(config.processingMs) || 0;
      if (processingMs > 0) {
        setProcessing(true);
        emitActivity('processing', typingBehavior);
        submitTimer = setTimeout(() => finishSubmit(resolved), processingMs);
      } else {
        finishSubmit(resolved);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const text = readText().trim();
        if (text) triggerSubmit(text);
      }
    };

    const onBlur = () => {
      clearTimeout(pauseTimer);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (disposed || activeSpeaking) return;
        behavior.setPointer(0, 0, false);
        setBehavior(idleBehavior, { preserveAudio: true });
        emitActivity('idle', idleBehavior);
      }, 950);
    };

    const form = inputEl.form;
    const onFormSubmit = () => {
      const text = readText().trim();
      if (text) triggerSubmit(text);
    };

    inputEl.addEventListener('focus', onFocus);
    inputEl.addEventListener('input', onInput);
    inputEl.addEventListener('keydown', onKeyDown);
    inputEl.addEventListener('blur', onBlur);
    form?.addEventListener('submit', onFormSubmit);

    const detach = () => {
      clearTimers();
      inputEl.removeEventListener('focus', onFocus);
      inputEl.removeEventListener('input', onInput);
      inputEl.removeEventListener('keydown', onKeyDown);
      inputEl.removeEventListener('blur', onBlur);
      form?.removeEventListener('submit', onFormSubmit);
    };
    cleanups.push(detach);
    return detach;
  }

  return {
    player,
    behavior,
    get state() {
      return behavior.state;
    },
    get dynamics() {
      return behavior.dynamics;
    },
    get values() {
      return { ...values };
    },
    get target() {
      return target;
    },
    get isPaused() {
      return paused;
    },
    get isSpeaking() {
      return activeSpeaking;
    },
    get isProcessing() {
      return activeProcessing;
    },
    get isReducedMotion() {
      return behavior.dynamics.reducedMotion;
    },
    get laptopMode() {
      return laptopMode;
    },
    get armGesture() {
      return armGesture;
    },
    get headphonesMode() {
      return headphonesMode;
    },
    setBehavior,
    setReaction,
    setMouth,
    setMouthValues,
    setLaptopMode,
    setArmGesture,
    setHeadphonesMode,
    setProcessing,
    setSpeakingActive(active) {
      activeSpeaking = !!active;
      if (activeSpeaking) manualMouthPinned = false;
      target.speaking = activeSpeaking ? 1 : 0;
    },
    setManualMouthPinned(pinned) {
      manualMouthPinned = !!pinned;
    },
    setProperty,
    applyProperties,
    getProperties: () => player.properties(),
    getInputs: () => (typeof player.inputs === 'function' ? player.inputs() : []),
    lookAt(x, y) {
      behavior.setPointer(x, y, true);
    },
    releaseGaze() {
      behavior.setPointer(0, 0, false);
    },
    triggerBlink(doubleBlink = false) {
      behavior.triggerBlink(doubleBlink);
    },
    notifyTypingActivity,
    attachInput,
    speakWithAudio,
    speakWithCues,
    stopSpeaking,
    setAutoLife(enabled) {
      autoLife = !!enabled;
    },
    pause() {
      explicitPaused = true;
      syncPauseState();
    },
    play() {
      explicitPaused = false;
      syncPauseState();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(touchReleaseTimer);
      intersectionObserver?.disconnect();
      if (pauseWhenOffscreen && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange);
      for (const fn of cleanups) {
        try { fn(); } catch { /* ignore */ }
      }
      cleanups.length = 0;
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(speechRaf);
      if (interactiveGaze) {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeave);
      }
      player.dispose();
    },
  };
}
