// Phase 5 Reactive Behavior Engine — Muse-style living mascot motion layers.
// Composes 5 independent, non-blocking layers into the 13-property GuideVM:
//   1. Autonomic breathing (dual-harmonic organic curve)
//   2. Natural blinking + occasional double-blinking (never interrupted by speech)
//   3. Independent eye/pupil tracking + micro-saccades + damped head follow-through
//   4. Emotional anticipation & recovery envelope across 12 behavior states
//   5. Subtle conversational & listening micro-accents (nonverbal states stay silent)

export const BEHAVIOR_STATES = [
  {
    id: 'IDLE-PARKED',
    label: 'IDLE-PARKED',
    emotion: 0,
    verbal: false,
    category: 'Presence',
    note: 'Quietly alive resting companion with soft breathing and organic blinks.',
    breathHz: 0.22,
    breathAmp: 0.72,
    gazeWanderX: 0.14,
    gazeWanderY: 0.08,
    headBiasX: 0,
    headBiasY: 0,
    saccadeRange: [2.4, 5.2],
    blinkRange: [3.0, 5.6],
    doubleBlinkChance: 0.18,
    anticipationY: 0.04,
    peakY: -0.05,
  },
  {
    id: 'IDLE-LOOKOUT',
    label: 'IDLE-LOOKOUT',
    emotion: 10,
    verbal: false,
    category: 'Presence',
    note: 'Gentle horizon scanning with subtle head follow-through.',
    breathHz: 0.24,
    breathAmp: 0.76,
    gazeWanderX: 0.48,
    gazeWanderY: 0.16,
    headBiasX: -0.1,
    headBiasY: -0.06,
    saccadeRange: [1.6, 3.6],
    blinkRange: [2.8, 5.0],
    doubleBlinkChance: 0.2,
    anticipationY: 0.05,
    peakY: -0.1,
  },
  {
    id: 'NAV-EXPLORE',
    label: 'NAV-EXPLORE',
    emotion: 6,
    verbal: false,
    category: 'Navigation',
    note: 'Purposeful forward curiosity scanning new routes and listings.',
    breathHz: 0.28,
    breathAmp: 0.82,
    gazeWanderX: 0.52,
    gazeWanderY: 0.2,
    headBiasX: 0.14,
    headBiasY: -0.08,
    saccadeRange: [1.2, 2.8],
    blinkRange: [2.7, 4.8],
    doubleBlinkChance: 0.16,
    anticipationY: 0.06,
    peakY: -0.12,
  },
  {
    id: 'TYPE-LISTEN',
    label: 'TYPE-LISTEN',
    emotion: 2,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal attentive listening with warm eye contact and gentle micro-nods.',
    breathHz: 0.23,
    breathAmp: 0.68,
    gazeWanderX: 0.08,
    gazeWanderY: 0.06,
    headBiasX: 0.08,
    headBiasY: 0.04,
    saccadeRange: [2.6, 5.0],
    blinkRange: [2.6, 4.6],
    doubleBlinkChance: 0.22,
    anticipationY: 0.04,
    peakY: 0.1,
    listenNod: true,
  },
  {
    id: 'TYPE-PONDER',
    label: 'TYPE-PONDER',
    emotion: 11,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal quiet reflection with soft upward gaze drift.',
    breathHz: 0.19,
    breathAmp: 0.78,
    gazeWanderX: 0.18,
    gazeWanderY: 0.1,
    headBiasX: -0.18,
    headBiasY: -0.18,
    gazeBiasX: 0.34,
    gazeBiasY: -0.34,
    saccadeRange: [2.2, 4.4],
    blinkRange: [3.2, 5.8],
    doubleBlinkChance: 0.15,
    anticipationY: 0.06,
    peakY: -0.14,
  },
  {
    id: 'WORK-THINK',
    label: 'WORK-THINK',
    emotion: 1,
    verbal: false,
    category: 'Attention',
    note: 'Nonverbal focused analysis with calm analytical gaze sweeps.',
    breathHz: 0.2,
    breathAmp: 0.7,
    gazeWanderX: 0.28,
    gazeWanderY: 0.1,
    headBiasX: -0.14,
    headBiasY: -0.12,
    gazeBiasX: -0.22,
    gazeBiasY: -0.24,
    saccadeRange: [1.5, 3.2],
    blinkRange: [3.1, 5.5],
    doubleBlinkChance: 0.14,
    anticipationY: 0.05,
    peakY: -0.1,
  },
  {
    id: 'SPEAK-ATTEND',
    label: 'SPEAK-ATTEND',
    emotion: 12,
    verbal: true,
    category: 'Speech',
    note: 'Conversational presence; speaking never interrupts blinking, breathing, or gaze.',
    breathHz: 0.25,
    breathAmp: 0.66,
    gazeWanderX: 0.16,
    gazeWanderY: 0.08,
    headBiasX: 0.05,
    headBiasY: -0.02,
    saccadeRange: [1.9, 3.9],
    blinkRange: [2.5, 4.7],
    doubleBlinkChance: 0.22,
    anticipationY: 0.03,
    peakY: -0.06,
  },
  {
    id: 'FAVORITE',
    label: 'FAVORITE',
    emotion: 3,
    verbal: false,
    category: 'Milestone',
    note: 'Warm affectionate delight with gentle anticipation and calm settle.',
    breathHz: 0.26,
    breathAmp: 0.84,
    gazeWanderX: 0.14,
    gazeWanderY: 0.08,
    headBiasX: 0.12,
    headBiasY: -0.06,
    saccadeRange: [2.2, 4.4],
    blinkRange: [2.8, 5.0],
    doubleBlinkChance: 0.24,
    anticipationY: 0.14,
    peakY: -0.22,
  },
  {
    id: 'PRICE DROP',
    label: 'PRICE DROP',
    emotion: 4,
    verbal: false,
    category: 'Milestone',
    note: 'Nonverbal surprised intrigue with crisp anticipation and smooth recovery.',
    breathHz: 0.27,
    breathAmp: 0.8,
    gazeWanderX: 0.18,
    gazeWanderY: 0.1,
    headBiasX: -0.1,
    headBiasY: -0.12,
    saccadeRange: [1.6, 3.2],
    blinkRange: [2.9, 5.1],
    doubleBlinkChance: 0.25,
    anticipationY: 0.16,
    peakY: -0.28,
  },
  {
    id: 'NEW HOME',
    label: 'NEW HOME',
    emotion: 5,
    verbal: false,
    category: 'Milestone',
    note: 'Bright hopeful discovery with welcoming gaze and warm halo.',
    breathHz: 0.26,
    breathAmp: 0.82,
    gazeWanderX: 0.22,
    gazeWanderY: 0.12,
    headBiasX: 0.12,
    headBiasY: -0.09,
    saccadeRange: [1.8, 3.6],
    blinkRange: [2.8, 4.9],
    doubleBlinkChance: 0.2,
    anticipationY: 0.12,
    peakY: -0.22,
  },
  {
    id: 'ARRIVED',
    label: 'ARRIVED',
    emotion: 7,
    verbal: false,
    category: 'Milestone',
    note: 'Calm grounded arrival with poised greeting and smooth rest.',
    breathHz: 0.23,
    breathAmp: 0.78,
    gazeWanderX: 0.12,
    gazeWanderY: 0.08,
    headBiasX: 0.08,
    headBiasY: -0.04,
    saccadeRange: [2.4, 4.8],
    blinkRange: [3.0, 5.4],
    doubleBlinkChance: 0.18,
    anticipationY: 0.1,
    peakY: -0.18,
  },
  {
    id: 'ACHIEVEMENT',
    label: 'ACHIEVEMENT',
    emotion: 8,
    verbal: false,
    category: 'Milestone',
    note: 'Poised pride with gentle celebratory lift and serene settle.',
    breathHz: 0.26,
    breathAmp: 0.86,
    gazeWanderX: 0.16,
    gazeWanderY: 0.1,
    headBiasX: 0.1,
    headBiasY: -0.1,
    saccadeRange: [2.0, 4.0],
    blinkRange: [2.7, 4.8],
    doubleBlinkChance: 0.22,
    anticipationY: 0.15,
    peakY: -0.26,
  },
];

export const BEHAVIOR_BY_ID = Object.fromEntries(BEHAVIOR_STATES.map((s) => [s.id, s]));

export function behaviorForEmotion(emotionIndex) {
  return BEHAVIOR_STATES.find((s) => s.emotion === emotionIndex) ?? BEHAVIOR_STATES[0];
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createBehaviorEngine() {
  let active = BEHAVIOR_STATES[0];
  let elapsed = 0;
  let stateTime = 10; // settled at start

  // Natural blink + occasional double-blink state machine
  let blinkPhase = 'open'; // 'open' | 'closing' | 'opening' | 'gap' | 'closing2' | 'opening2'
  let blinkTimer = 0;
  let nextBlinkIn = randRange(2.4, 4.4);
  let willDoubleBlink = false;
  let blinkValue = 0;

  // Organic autonomous micro-saccade state
  let saccadeTimer = 0;
  let nextSaccadeIn = randRange(1.4, 3.2);
  let saccadeX = 0;
  let saccadeY = 0;
  let pointerActive = false;
  let pointerIdleTime = 10;
  let pointerX = 0;
  let pointerY = 0;

  // Live rig dynamics (configurable in Studio Rig controls)
  const dynamics = {
    blinkCadence: 1.0,       // 0.6..1.6 (higher = slightly more frequent blinks)
    doubleBlinkRate: 1.0,    // 0..2.0 multiplier
    headInertia: 1.0,        // 0.5..1.8 (higher = silkier slower head follow)
    breathDepth: 1.0,        // 0.4..1.5
    speechAccent: 1.0,       // 0..1.5 subtle head accents during speech
  };

  function setState(id) {
    const next = BEHAVIOR_BY_ID[id];
    if (!next) return active;
    active = next;
    stateTime = 0;
    // Slight immediate gaze refresh on state change
    nextSaccadeIn = Math.min(nextSaccadeIn, 0.35);
    return active;
  }

  function setPointer(x, y, isInside) {
    pointerActive = !!isInside;
    if (isInside) {
      pointerX = clamp(x, -1, 1);
      pointerY = clamp(y, -1, 1);
      pointerIdleTime = 0;
    }
  }

  function updateBlink(dt) {
    const closeDur = 0.062;
    const openDur = 0.088;
    const gapDur = 0.135;

    blinkTimer += dt;
    if (blinkPhase === 'open') {
      blinkValue = 0;
      if (blinkTimer >= nextBlinkIn) {
        blinkPhase = 'closing';
        blinkTimer = 0;
        const chance = clamp(active.doubleBlinkChance * dynamics.doubleBlinkRate, 0, 0.65);
        willDoubleBlink = Math.random() < chance;
      }
    } else if (blinkPhase === 'closing' || blinkPhase === 'closing2') {
      const u = clamp(blinkTimer / closeDur, 0, 1);
      blinkValue = u * u * (3 - 2 * u);
      if (u >= 1) {
        blinkPhase = blinkPhase === 'closing' ? 'opening' : 'opening2';
        blinkTimer = 0;
      }
    } else if (blinkPhase === 'opening') {
      const u = clamp(blinkTimer / openDur, 0, 1);
      blinkValue = 1 - u * u * (3 - 2 * u);
      if (u >= 1) {
        blinkValue = 0;
        blinkTimer = 0;
        if (willDoubleBlink) {
          blinkPhase = 'gap';
        } else {
          blinkPhase = 'open';
          const [bMin, bMax] = active.blinkRange;
          nextBlinkIn = randRange(bMin, bMax) / clamp(dynamics.blinkCadence, 0.5, 2.0);
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
      blinkValue = 1 - u * u * (3 - 2 * u);
      if (u >= 1) {
        blinkValue = 0;
        blinkPhase = 'open';
        blinkTimer = 0;
        const [bMin, bMax] = active.blinkRange;
        nextBlinkIn = randRange(bMin, bMax) / clamp(dynamics.blinkCadence, 0.5, 2.0);
      }
    }
    return blinkValue;
  }

  function triggerBlink(doubleBlink = false) {
    blinkPhase = 'closing';
    blinkTimer = 0;
    willDoubleBlink = doubleBlink;
  }

  // Smooth anticipation (0..0.12s) -> expressive peak (0.12..0.46s) -> gentle recovery (0.46..1.15s)
  function anticipationEnvelope(t) {
    if (t >= 1.2) return 0;
    if (t < 0.12) {
      const u = t / 0.12;
      return active.anticipationY * Math.sin(u * Math.PI * 0.5);
    }
    if (t < 0.44) {
      const u = (t - 0.12) / 0.32;
      const ease = u * u * (3 - 2 * u);
      return active.anticipationY * (1 - ease) + active.peakY * ease;
    }
    const u = (t - 0.44) / 0.76;
    const ease = 1 - Math.pow(1 - clamp(u, 0, 1), 3);
    return active.peakY * (1 - ease);
  }

  /**
   * Computes autonomous targets for the current frame.
   * Note: `speakingLevel` (0..1) adds subtle conversational cadence WITHOUT
   * ever suppressing natural blinking, breathing, or independent eye tracking.
   */
  function step(dt, { speakingLevel = 0, mouthEnergy = 0 } = {}) {
    elapsed += dt;
    stateTime += dt;
    if (!pointerActive) pointerIdleTime += dt;

    // 1. Dual-harmonic organic breathing (quiet, non-robotic)
    const w = elapsed * Math.PI * 2 * active.breathHz;
    const rawBreath = Math.sin(w) * 0.76 + Math.sin(w * 0.5 + 1.1) * 0.24;
    const breath = clamp(rawBreath * active.breathAmp * dynamics.breathDepth, -1, 1);

    // 2. Natural blinking & occasional double-blinking (runs continuously even while speaking)
    const blink = updateBlink(dt);

    // 3. Organic micro-saccades when idle or subtly layered under focus
    saccadeTimer += dt;
    if (saccadeTimer >= nextSaccadeIn) {
      saccadeTimer = 0;
      const [sMin, sMax] = active.saccadeRange;
      nextSaccadeIn = randRange(sMin, sMax);
      saccadeX = randRange(-active.gazeWanderX, active.gazeWanderX);
      saccadeY = randRange(-active.gazeWanderY, active.gazeWanderY);
    }

    // Smooth resting return after pointer leaves (blends gracefully back over ~1.4s)
    const pointerWeight = pointerActive ? 1 : Math.exp(-pointerIdleTime * 1.4);

    // 4. Subtle listening micro-nods & conversational speech accents
    let accentX = 0;
    let accentY = anticipationEnvelope(stateTime);

    if (active.listenNod && speakingLevel < 0.05) {
      // Gentle occasional affirmative micro-nod every ~3.4s while listening
      const nodCycle = elapsed % 3.4;
      if (nodCycle < 0.75) {
        accentY += Math.sin((nodCycle / 0.75) * Math.PI) * 0.14;
      }
    }

    if (speakingLevel > 0.05) {
      // Subtle organic speech emphasis head motion (restrained, Muse-style)
      const cadence = (0.04 + mouthEnergy * 0.12) * speakingLevel * dynamics.speechAccent;
      accentY += Math.sin(elapsed * 4.2) * cadence;
      accentX += Math.sin(elapsed * 1.9 + 0.6) * cadence * 0.75;
    }

    // Gentle quiet torso/head idle sway
    const idleDriftX = Math.sin(elapsed * 0.63) * 0.07 + Math.sin(elapsed * 0.29 + 1.7) * 0.04;
    const idleDriftY = Math.cos(elapsed * 0.47) * 0.05;

    const baseLookX = (active.gazeBiasX ?? active.headBiasX) + saccadeX + idleDriftX * 0.6;
    const baseLookY = (active.gazeBiasY ?? active.headBiasY) + saccadeY + idleDriftY * 0.5;

    const lookX = clamp(baseLookX * (1 - pointerWeight) + pointerX * pointerWeight + accentX * 0.35, -1, 1);
    const lookY = clamp(baseLookY * (1 - pointerWeight) + pointerY * pointerWeight + accentY * 0.25, -1, 1);

    // Head follows gaze with slightly reduced amplitude + independent bias + subtle anticipation/recovery
    const headX = clamp(
      (active.headBiasX + idleDriftX) * (1 - pointerWeight * 0.65) + lookX * 0.62 + accentX,
      -1,
      1,
    );
    const headY = clamp(
      (active.headBiasY + idleDriftY) * (1 - pointerWeight * 0.65) + lookY * 0.58 + accentY,
      -1,
      1,
    );

    return {
      breath,
      blink,
      lookX,
      lookY,
      headX,
      headY,
      emotion: active.emotion,
      eyeFollowSpeed: 13.5,
      headFollowSpeed: 4.8 / clamp(dynamics.headInertia, 0.5, 2.0),
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
