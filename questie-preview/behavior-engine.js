// Phase 5.2 Host Behavior Orchestrator — complements native .riv autonomous layers.
// Native .riv State Machine 'Guide' already runs 4 simultaneous layers with zero host JS:
//   - Idle (7.6s serene breathing across 6 planes + shoulder sway + status ball aura)
//   - AutoBlink (9.8s irregular single & double natural blinking)
//   - AutoGaze (12.4s subtle autonomous micro-glances)
//   - Emotion (13 looping native reactive performances incl. articulated arms, hands & laptop)
//
// This host orchestrator layers interactive responsiveness on top without competing:
//   1. Gentle additive breath responsiveness (native .riv Idle carries primary breathing)
//   2. Interactive & turn-blink reflexes (native .riv AutoBlink carries autonomous idle blinks)
//   3. Gaze anticipation before head turns (~190ms lead buffer: eyes shift first, head follows)
//   4. Quasi-periodic non-repeating subtle poise & pointer/touch follow with graceful return
//   5. Soft anticipation & recovery envelope across all 12 independent behavior states
//   6. Subtle non-competing resting facial microexpressions (yields cleanly during speech)

export const BEHAVIOR_STATES = [
  {
    id: 'IDLE-PARKED',
    label: 'IDLE-PARKED',
    emotion: 0,
    verbal: false,
    category: 'Presence',
    note: 'Quietly alive resting companion — native .riv breathing, blinking, and soft ambient poise.',
    breathHz: 0.15,
    breathAmp: 0.32,
    gazeWanderX: 0.36,
    gazeWanderY: 0.14,
    headBiasX: 0,
    headBiasY: 0,
    saccadeRange: [2.5, 5.1],
    blinkRange: [3.6, 6.8],
    doubleBlinkChance: 0.22,
    anticipationY: 0.03,
    peakY: -0.04,
    microSmileWide: 0.055,
    microSmileOpen: -0.008,
  },
  {
    id: 'IDLE-LOOKOUT',
    label: 'IDLE-LOOKOUT',
    emotion: 10,
    verbal: false,
    category: 'Presence',
    note: 'Calm horizon scanning where eyes lead smoothly before gentle head follow-through.',
    breathHz: 0.145,
    breathAmp: 0.2,
    gazeWanderX: 0.42,
    gazeWanderY: 0.14,
    headBiasX: -0.08,
    headBiasY: -0.05,
    saccadeRange: [3.2, 6.4],
    blinkRange: [3.8, 7.2],
    doubleBlinkChance: 0.16,
    anticipationY: 0.03,
    peakY: -0.07,
    microSmileWide: 0.02,
    microSmileOpen: -0.01,
  },
  {
    id: 'NAV-EXPLORE',
    label: 'NAV-EXPLORE',
    emotion: 6,
    verbal: false,
    category: 'Navigation',
    note: 'Unrushed forward curiosity with articulated scouting stride and soft gaze anticipation.',
    breathHz: 0.165,
    breathAmp: 0.22,
    gazeWanderX: 0.46,
    gazeWanderY: 0.15,
    headBiasX: 0.12,
    headBiasY: -0.06,
    saccadeRange: [2.4, 4.8],
    blinkRange: [3.6, 6.8],
    doubleBlinkChance: 0.14,
    anticipationY: 0.035,
    peakY: -0.08,
    microSmileWide: 0.03,
    microSmileOpen: 0.0,
  },
  {
    id: 'TYPE-LISTEN',
    label: 'TYPE-LISTEN',
    emotion: 2,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal warm listening with attentive posture, steady gaze, and gentle micro-nods.',
    breathHz: 0.14,
    breathAmp: 0.16,
    gazeWanderX: 0.06,
    gazeWanderY: 0.04,
    headBiasX: 0.05,
    headBiasY: 0.03,
    saccadeRange: [4.4, 8.0],
    blinkRange: [3.6, 6.8],
    doubleBlinkChance: 0.18,
    anticipationY: 0.025,
    peakY: 0.065,
    listenNod: true,
    microSmileWide: 0.055,
    microSmileOpen: -0.008,
  },
  {
    id: 'TYPE-PONDER',
    label: 'TYPE-PONDER',
    emotion: 11,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal reflection over the open laptop with chin-resting hand and thoughtful gaze drift.',
    breathHz: 0.13,
    breathAmp: 0.2,
    gazeWanderX: 0.18,
    gazeWanderY: 0.1,
    headBiasX: -0.09,
    headBiasY: -0.06,
    gazeBiasX: 0.24,
    gazeBiasY: -0.18,
    saccadeRange: [3.6, 6.8],
    blinkRange: [4.2, 8.4],
    doubleBlinkChance: 0.14,
    anticipationY: 0.035,
    peakY: -0.08,
    microSmileWide: -0.025,
    microSmileOpen: -0.018,
  },
  {
    id: 'WORK-THINK',
    label: 'WORK-THINK',
    emotion: 1,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal focused laptop session with articulated typing hands and smooth reading eye sweeps.',
    breathHz: 0.135,
    breathAmp: 0.18,
    gazeWanderX: 0.26,
    gazeWanderY: 0.08,
    headBiasX: -0.04,
    headBiasY: 0.12,
    gazeBiasX: 0.0,
    gazeBiasY: 0.28,
    saccadeRange: [2.1, 4.2],
    blinkRange: [4.0, 7.8],
    doubleBlinkChance: 0.14,
    anticipationY: 0.03,
    peakY: 0.06,
    microSmileWide: -0.055,
    microSmileOpen: -0.028,
  },
  {
    id: 'SPEAK-ATTEND',
    label: 'SPEAK-ATTEND',
    emotion: 12,
    verbal: true,
    category: 'Speech',
    note: 'Natural conversational presence; speech blends smoothly without interrupting blink or breath.',
    breathHz: 0.16,
    breathAmp: 0.16,
    gazeWanderX: 0.12,
    gazeWanderY: 0.06,
    headBiasX: 0.04,
    headBiasY: -0.02,
    saccadeRange: [3.0, 5.8],
    blinkRange: [3.0, 6.0],
    doubleBlinkChance: 0.18,
    anticipationY: 0.02,
    peakY: -0.045,
    microSmileWide: 0.04,
    microSmileOpen: 0.0,
  },
  {
    id: 'FAVORITE',
    label: 'FAVORITE',
    emotion: 3,
    verbal: false,
    category: 'Milestone',
    note: 'Warm affectionate delight with gentle anticipation, heart-hold gesture, and calm settle.',
    breathHz: 0.165,
    breathAmp: 0.22,
    gazeWanderX: 0.12,
    gazeWanderY: 0.06,
    headBiasX: 0.1,
    headBiasY: -0.05,
    saccadeRange: [3.4, 6.4],
    blinkRange: [3.2, 6.2],
    doubleBlinkChance: 0.2,
    anticipationY: 0.09,
    peakY: -0.14,
    microSmileWide: 0.12,
    microSmileOpen: 0.035,
  },
  {
    id: 'PRICE DROP',
    label: 'PRICE DROP',
    emotion: 4,
    verbal: false,
    category: 'Milestone',
    note: 'Nonverbal bright intrigue with crisp gaze anticipation and smooth settled recovery.',
    breathHz: 0.17,
    breathAmp: 0.2,
    gazeWanderX: 0.15,
    gazeWanderY: 0.08,
    headBiasX: -0.08,
    headBiasY: -0.09,
    saccadeRange: [2.6, 5.0],
    blinkRange: [3.4, 6.5],
    doubleBlinkChance: 0.22,
    anticipationY: 0.1,
    peakY: -0.17,
    microSmileWide: -0.03,
    microSmileOpen: 0.065,
  },
  {
    id: 'NEW HOME',
    label: 'NEW HOME',
    emotion: 5,
    verbal: false,
    category: 'Milestone',
    note: 'Hopeful discovery with articulated presenting gesture, warm gaze, and luminous glow.',
    breathHz: 0.165,
    breathAmp: 0.2,
    gazeWanderX: 0.18,
    gazeWanderY: 0.1,
    headBiasX: 0.1,
    headBiasY: -0.07,
    saccadeRange: [2.8, 5.4],
    blinkRange: [3.2, 6.2],
    doubleBlinkChance: 0.18,
    anticipationY: 0.08,
    peakY: -0.14,
    microSmileWide: 0.11,
    microSmileOpen: 0.03,
  },
  {
    id: 'ARRIVED',
    label: 'ARRIVED',
    emotion: 7,
    verbal: false,
    category: 'Milestone',
    note: 'Calm grounded arrival with articulated right-hand greeting wave and serene settle.',
    breathHz: 0.15,
    breathAmp: 0.2,
    gazeWanderX: 0.1,
    gazeWanderY: 0.06,
    headBiasX: 0.06,
    headBiasY: -0.03,
    saccadeRange: [3.8, 7.2],
    blinkRange: [3.5, 6.8],
    doubleBlinkChance: 0.15,
    anticipationY: 0.065,
    peakY: -0.11,
    microSmileWide: 0.09,
    microSmileOpen: 0.02,
  },
  {
    id: 'ACHIEVEMENT',
    label: 'ACHIEVEMENT',
    emotion: 8,
    verbal: false,
    category: 'Milestone',
    note: 'Dignified warmth and celebratory hand lift without exaggerated bounce.',
    breathHz: 0.165,
    breathAmp: 0.22,
    gazeWanderX: 0.14,
    gazeWanderY: 0.08,
    headBiasX: 0.08,
    headBiasY: -0.08,
    saccadeRange: [3.2, 6.0],
    blinkRange: [3.2, 6.2],
    doubleBlinkChance: 0.18,
    anticipationY: 0.085,
    peakY: -0.15,
    microSmileWide: 0.13,
    microSmileOpen: 0.04,
  },
];

export const BEHAVIOR_BY_ID = Object.fromEntries(BEHAVIOR_STATES.map((s) => [s.id, s]));

export function behaviorForEmotion(emotionIndex) {
  return BEHAVIOR_STATES.find((s) => s.emotion === emotionIndex) ?? BEHAVIOR_STATES[0];
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Skewed organic interval (produces natural clusters + occasional serene long pauses)
function naturalInterval(min, max) {
  const u = (Math.random() + Math.random()) * 0.5;
  const tail = Math.random() < 0.16 ? randRange(1.15, 1.48) : 1.0;
  return (min + u * (max - min)) * tail;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smootherstep(u) {
  const x = clamp(u, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function createBehaviorEngine() {
  let active = BEHAVIOR_STATES[0];
  let elapsed = 0;
  let breathPhase = 0;
  let stateTime = 10; // settled at start

  // Natural irregular blinking state machine (includes soft contact hold + occasional double-blink)
  let blinkPhase = 'open'; // 'open' | 'closing' | 'hold' | 'opening' | 'gap' | 'closing2' | 'hold2' | 'opening2'
  let blinkTimer = 0;
  let nextBlinkIn = naturalInterval(2.8, 5.8);
  let willDoubleBlink = false;
  let blinkValue = 0;

  // Unhurried autonomous saccade state
  let saccadeTimer = 0;
  let nextSaccadeIn = naturalInterval(2.6, 5.6);
  let saccadeX = 0;
  let saccadeY = 0;

  // Gaze anticipation ring buffer: eyes lead clearly before head follows (~210ms Muse timing)
  const gazeHistory = [];
  const GAZE_LEAD_SECONDS = 0.21;

  // Pointer / touch tracking with graceful slow resting return
  let pointerActive = false;
  let pointerIdleTime = 10;
  let pointerX = 0;
  let pointerY = 0;

  // Irregular listening nod scheduler
  let nextNodAt = randRange(3.8, 6.6);
  let nodProgress = 1;

  // Periodic natural downward keyboard glances while typing/working at the miniature laptop
  let nextKeyboardGlanceAt = randRange(1.4, 2.8);
  let keyboardGlanceProgress = 1;
  let keyboardGlanceX = 0;

  // Live rig dynamics (configurable in Studio Rig controls)
  const dynamics = {
    blinkCadence: 1.0,       // 0.6..1.6
    doubleBlinkRate: 1.0,    // 0..2.0
    headInertia: 1.0,        // 0.5..1.8 (higher = silkier slower head follow)
    breathDepth: 1.0,        // 0.4..1.5
    speechAccent: 1.0,       // 0..1.5 subtle head accents during speech
    reducedMotion: false,    // scales dynamic motion smoothly for prefers-reduced-motion
  };

  function setState(id) {
    const next = BEHAVIOR_BY_ID[id];
    if (!next) return active;
    active = next;
    stateTime = 0;
    nextSaccadeIn = Math.min(nextSaccadeIn, 0.55);
    return active;
  }

  function setPointer(x, y, isInside) {
    pointerActive = !!isInside;
    if (isInside) {
      const nx = clamp(x, -1, 1);
      const ny = clamp(y, -1, 1);
      pointerX = nx;
      pointerY = ny;
      pointerIdleTime = 0;
    }
  }

  function updateBlink(dt) {
    // Native .riv AutoBlink layer handles serene periodic & double idle blinks autonomously.
    // Host GuideVM.blink stays at 0 unless triggered interactively (click, double-tap, turn-blink
    // reflex, or rare extra double-blink when doubleBlinkRate > 1.2) so both layers never collide.
    const closeDur = 0.076;
    const holdDur = 0.026;
    const openDur = 0.132;
    const gapDur = 0.165;

    blinkTimer += dt;
    if (blinkPhase === 'open') {
      blinkValue = 0;
      if (dynamics.doubleBlinkRate > 1.25 && blinkTimer >= nextBlinkIn * 1.9) {
        blinkPhase = 'closing';
        blinkTimer = 0;
        willDoubleBlink = true;
      }
    } else if (blinkPhase === 'closing' || blinkPhase === 'closing2') {
      const u = clamp(blinkTimer / closeDur, 0, 1);
      blinkValue = smootherstep(u);
      if (u >= 1) {
        blinkPhase = blinkPhase === 'closing' ? 'hold' : 'hold2';
        blinkTimer = 0;
      }
    } else if (blinkPhase === 'hold' || blinkPhase === 'hold2') {
      blinkValue = 1;
      if (blinkTimer >= holdDur) {
        blinkPhase = blinkPhase === 'hold' ? 'opening' : 'opening2';
        blinkTimer = 0;
      }
    } else if (blinkPhase === 'opening') {
      const u = clamp(blinkTimer / openDur, 0, 1);
      blinkValue = 1 - smootherstep(u);
      if (u >= 1) {
        blinkValue = 0;
        blinkTimer = 0;
        if (willDoubleBlink) {
          blinkPhase = 'gap';
        } else {
          blinkPhase = 'open';
          const [bMin, bMax] = active.blinkRange;
          nextBlinkIn = naturalInterval(bMin, bMax) / clamp(dynamics.blinkCadence, 0.5, 2.0);
        }
      }
    } else if (blinkPhase === 'gap') {
      blinkValue = 0;
      if (blinkTimer >= gapDur) {
        blinkPhase = 'closing2';
        blinkTimer = 0;
      }
    } else if (blinkPhase === 'opening2') {
      const u = clamp(blinkTimer / openDur, 0, 1);
      blinkValue = 1 - smootherstep(u);
      if (u >= 1) {
        blinkValue = 0;
        blinkPhase = 'open';
        blinkTimer = 0;
        const [bMin, bMax] = active.blinkRange;
        nextBlinkIn = naturalInterval(bMin, bMax) / clamp(dynamics.blinkCadence, 0.5, 2.0);
      }
    }
    return blinkValue;
  }

  function triggerBlink(doubleBlink = false) {
    blinkPhase = 'closing';
    blinkTimer = 0;
    willDoubleBlink = doubleBlink;
  }

  // Asymmetric organic breath curve: gentle 42% inhale, serene 58% exhale settle
  function organicBreathCurve(phase01) {
    const p = ((phase01 % 1) + 1) % 1;
    if (p < 0.42) {
      const u = p / 0.42;
      return -1 + 2 * smootherstep(u);
    }
    const u = (p - 0.42) / 0.58;
    return 1 - 2 * smootherstep(u);
  }

  // Soft anticipation (0..0.18s) -> poised peak (0.18..0.62s) -> serene recovery (0.62..1.65s)
  function anticipationEnvelope(t) {
    if (t >= 1.7) return 0;
    if (t < 0.18) {
      return active.anticipationY * smootherstep(t / 0.18);
    }
    if (t < 0.62) {
      const ease = smootherstep((t - 0.18) / 0.44);
      return active.anticipationY * (1 - ease) + active.peakY * ease;
    }
    const ease = smootherstep((t - 0.62) / 1.08);
    return active.peakY * (1 - ease);
  }

  function sampleDelayedGaze(now, fallbackX, fallbackY) {
    const targetTime = now - GAZE_LEAD_SECONDS;
    while (gazeHistory.length > 2 && gazeHistory[1].t <= targetTime) {
      gazeHistory.shift();
    }
    if (!gazeHistory.length) return { x: fallbackX, y: fallbackY };
    return { x: gazeHistory[0].x, y: gazeHistory[0].y };
  }

  /**
   * Computes serene, coordinated targets for the current frame.
   * Speaking adds subtle conversational warmth without ever interrupting blinking,
   * breathing, or independent eye tracking.
   */
  function step(dt, { speakingLevel = 0, mouthEnergy = 0 } = {}) {
    elapsed += dt;
    stateTime += dt;
    if (!pointerActive) pointerIdleTime += dt;

    const rmScale = dynamics.reducedMotion ? 0.28 : 1.0;

    // 1. Slow asymmetric organic breathing (~6.5-7.5s calm rhythm with tiny harmonic breath depth)
    breathPhase += dt * active.breathHz;
    const primaryBreath = organicBreathCurve(breathPhase);
    const breathMod = 0.88 + 0.12 * Math.sin(elapsed * 0.21 + 0.9);
    const breath = clamp(primaryBreath * breathMod * active.breathAmp * dynamics.breathDepth * rmScale, -1, 1);

    // 2. Irregular natural blinking (continuous across all states including speech)
    const blink = updateBlink(dt);

    // 3. Unhurried autonomous gaze shifts + organic turn-blink reflex on wide eye sweeps
    saccadeTimer += dt;
    if (saccadeTimer >= nextSaccadeIn) {
      saccadeTimer = 0;
      const [sMin, sMax] = active.saccadeRange;
      nextSaccadeIn = naturalInterval(sMin, sMax);
      const nextX = randRange(-active.gazeWanderX, active.gazeWanderX) * rmScale;
      const nextY = randRange(-active.gazeWanderY, active.gazeWanderY) * rmScale;
      const jump = Math.hypot(nextX - saccadeX, nextY - saccadeY);
      saccadeX = nextX;
      saccadeY = nextY;
      // Subtle human blink reflex on wide saccade shifts
      if (jump > 0.5 && blinkPhase === 'open' && Math.random() < 0.34) {
        blinkPhase = 'closing';
        blinkTimer = 0;
        willDoubleBlink = false;
      }
    }

    // Graceful slow resting return after pointer/touch leaves (~2.4s calm fade back)
    const pointerWeight = pointerActive ? 1 : Math.exp(-pointerIdleTime * 0.72);

    // 4. Subtle listening micro-nods, keyboard glances during typing, & restrained speech poise
    let accentX = 0;
    let accentY = anticipationEnvelope(stateTime) * rmScale;
    let keyboardGlanceWeight = 0;

    if (active.id === 'WORK-THINK' && speakingLevel < 0.05) {
      if (elapsed >= nextKeyboardGlanceAt && keyboardGlanceProgress >= 1) {
        keyboardGlanceProgress = 0;
        keyboardGlanceX = randRange(-0.26, 0.26);
        nextKeyboardGlanceAt = elapsed + randRange(2.1, 4.2);
      }
      if (keyboardGlanceProgress < 1) {
        keyboardGlanceProgress = Math.min(1, keyboardGlanceProgress + dt / 1.15);
        keyboardGlanceWeight = Math.sin(smootherstep(keyboardGlanceProgress) * Math.PI) * rmScale;
        accentY += keyboardGlanceWeight * 0.14;
      }
    }

    if (active.listenNod && speakingLevel < 0.05) {
      if (elapsed >= nextNodAt && nodProgress >= 1) {
        nodProgress = 0;
        nextNodAt = elapsed + randRange(4.2, 7.6);
      }
      if (nodProgress < 1) {
        nodProgress = Math.min(1, nodProgress + dt / 1.05);
        accentY += Math.sin(smootherstep(nodProgress) * Math.PI) * 0.1 * rmScale;
      }
    }

    if (speakingLevel > 0.05) {
      // Gentle, dignified conversational sway (no frantic bobbing)
      const cadence = (0.025 + mouthEnergy * 0.075) * speakingLevel * dynamics.speechAccent * rmScale;
      accentY += Math.sin(elapsed * 2.4) * cadence;
      accentX += Math.sin(elapsed * 1.13 + 0.7) * cadence * 0.8;
    }

    // Quasi-periodic non-repeating subtle torso/head idle poise (irrational frequencies)
    const idleDriftX = (Math.sin(elapsed * 0.42) * 0.125 + Math.sin(elapsed * 0.23 + 1.9) * 0.075) * rmScale;
    const idleDriftY = (Math.cos(elapsed * 0.31 + 0.5) * 0.08 + Math.sin(elapsed * 0.17) * 0.045) * rmScale;

    const baseLookX = (active.gazeBiasX ?? active.headBiasX) * rmScale + saccadeX + idleDriftX * 0.5;
    const baseLookY = (active.gazeBiasY ?? active.headBiasY) * rmScale + saccadeY + idleDriftY * 0.45;

    // Eyes acquire gaze immediately (gaze anticipation!) and glance down at keys while typing
    const rawLookX = baseLookX * (1 - pointerWeight) + pointerX * pointerWeight * rmScale + accentX * 0.25;
    const rawLookY = baseLookY * (1 - pointerWeight) + pointerY * pointerWeight * rmScale + accentY * 0.2;
    const lookX = clamp(rawLookX * (1 - keyboardGlanceWeight * 0.65) + keyboardGlanceX * keyboardGlanceWeight * 0.65, -1, 1);
    const lookY = clamp(rawLookY * (1 - keyboardGlanceWeight * 0.7) + 0.54 * keyboardGlanceWeight * 0.7, -1, 1);

    // Record gaze for ~190ms delayed head follow-through
    gazeHistory.push({ t: elapsed, x: lookX, y: lookY });
    const delayedGaze = sampleDelayedGaze(elapsed, lookX, lookY);

    // Head follows delayed gaze smoothly with subtle natural inertia & coordinated poise
    const headX = clamp(
      (active.headBiasX * rmScale + idleDriftX) * (1 - pointerWeight * 0.6) + delayedGaze.x * 0.62 + accentX,
      -1,
      1,
    );
    const headY = clamp(
      (active.headBiasY * rmScale + idleDriftY) * (1 - pointerWeight * 0.6) + delayedGaze.y * 0.58 + accentY,
      -1,
      1,
    );

    // 5. Gentle resting facial microexpressions (subtle organic warmth breathing in mouth corners)
    const microWave = Math.sin(elapsed * 0.38 + 0.4) * 0.5 + 0.5;
    const microSmileWide = (active.microSmileWide ?? 0) * (0.78 + microWave * 0.22);
    const microSmileOpen = (active.microSmileOpen ?? 0) * (0.8 + microWave * 0.2);

    const inertia = clamp(dynamics.headInertia, 0.5, 2.0);
    return {
      breath,
      blink,
      lookX,
      lookY,
      headX,
      headY,
      emotion: active.emotion,
      microSmileWide,
      microSmileOpen,
      // Natural angular frequencies (rad/s) for critically damped 2nd-order springs
      eyeOmega: 11.0,
      headOmega: 3.1 / inertia,
      breathOmega: 3.0,
    };
  }

  return {
    get state() {
      return active;
    },
    dynamics,
    setState,
    setPointer,
    triggerBlink,
    step,
  };
}
