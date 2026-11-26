// Native OpenRive Living Mascot Engine — Pin & Geo Articulated Rigs.
// All drawing coordinates are in a 128x136 logical artboard.
// Authors character anatomy, articulated 2-segment arms + sculpted hands, native laptop prop,
// sculpted 3D lighting, anatomical curved eyelids, continuous mouth deformation, and a
// 4-layer autonomous Rive State Machine (Idle + AutoBlink + AutoGaze + 13 looping Emotion
// performances) directly inside the portable .riv file.
// Preserves the exact 13-property GuideVM contract, 8 visemes, 13 reactions, and byte-identical round-trip.
import {
  addAnimation,
  addDataProperty,
  addGroup,
  addInput,
  addKeyframes,
  addPath,
  addShape,
  addState,
  addStateMachine,
  addTransition,
  applyThemeColor,
  defineColor,
  parseColor,
} from './api';
import { newDoc, newLayer, obj } from './factory';
import { encodePath, findProperty } from './databind';
import type { CoreObj } from './document';
import type { Template } from './templates';

export const GUIDE_REACTIONS = [
  ['ready', '#24e3ca'], ['thinking', '#ba9cfa'], ['listening', '#71cdfc'],
  ['favorite', '#ff6484'], ['pricedrop', '#ffad4a'], ['newhome', '#ffd565'],
  ['traveling', '#55a9ff'], ['arrived', '#63eab2'], ['achievement', '#ffd565'],
  ['guide', '#86d9ff'], ['lookout', '#24e3ca'], ['ponder', '#ba9cfa'], ['speaking', '#86d9ff'],
] as const;

export const GUIDE_MOUTHS = [
  ['rest', 7, 1.4, 0, 0], ['MBP', 7, 0.65, 0, 0], ['AI', 7.5, 5.1, 0, 1],
  ['E', 9.5, 2.6, 1, 0], ['OU', 3.9, 5.3, 0, 0], ['FV', 8, 1.9, 1, 0],
  ['THL', 6.3, 3.5, 1, 1], ['teeth', 8.7, 2, 1, 0],
] as const;

export const GUIDE_PROPERTIES = {
  lookX: 0,
  lookY: 0,
  headX: 0,
  headY: 0,
  blink: 0,
  mouthOpen: 1.4 / 6,
  mouthWide: 0.7,
  teeth: 0,
  tongue: 0,
  breath: 0,
  emotion: 0,
  speaking: 0,
  mouthShape: 0,
} as const;

type GuideProperty = keyof typeof GUIDE_PROPERTIES;

export type GlintStyle = 'muse' | 'studio' | 'classic';

export interface QuestieCustomization {
  preset: 'Pin' | 'Geo';
  shellColor: string;
  shellEdge: string;
  shellLight: string;
  beaconColor: string;
  showBackpack: boolean;
  backpackColor: string;
  blushColor: string;
  glossOpacity: number;
  irisColor: string;
  irisRingColor: string;
  scleraColor: string;
  eyeScale: number;
  irisScale: number;
  glintStyle: GlintStyle;
  browThickness: number;
  browArch: number;
  parallaxDepth: number;
  eyeTrackingRange: number;
  breathingScale: number;
  mouthScale: number;
}

export function defaultQuestieCustomization(preset: 'Pin' | 'Geo'): QuestieCustomization {
  const pin = preset === 'Pin';
  return {
    preset,
    shellColor: pin ? '#f2784b' : '#18a8a3',
    shellEdge: pin ? '#b94422' : '#0e5b72',
    shellLight: pin ? '#ffdcc5' : '#b8fff0',
    beaconColor: '#1ee2d6',
    showBackpack: true,
    backpackColor: pin ? '#e4a141' : '#a87844',
    blushColor: pin ? '#f5646c' : '#ff98ae',
    glossOpacity: pin ? 0.52 : 0.54,
    irisColor: pin ? '#0e3656' : '#163446',
    irisRingColor: pin ? '#24d4ce' : '#2ea3ae',
    scleraColor: '#fffefa',
    eyeScale: pin ? 1.13 : 1,
    irisScale: pin ? 1.18 : 1,
    glintStyle: 'muse',
    browThickness: pin ? 2.65 : 2.2,
    browArch: pin ? 0.34 : 0.28,
    parallaxDepth: 1,
    eyeTrackingRange: 1,
    breathingScale: 1,
    mouthScale: pin ? 1.06 : 1,
  };
}

function clampNum(v: number, min: number, max: number) {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

function parseRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length < 6) return [255, 255, 255];
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function hexWithAlpha(hex: string, alphaHex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  const rgb = clean.length >= 6 ? clean.slice(0, 6) : 'ffffff';
  return `#${rgb}${alphaHex}`;
}

function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = parseRgb(hex);
  return toHex(r * factor, g * factor, b * factor);
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const u = clampNum(t, 0, 1);
  const [ar, ag, ab] = parseRgb(hexA);
  const [br, bg, bb] = parseRgb(hexB);
  return toHex(ar + (br - ar) * u, ag + (bg - ag) * u, ab + (bb - ab) * u);
}

export function buildQuestieGuide(name: 'Pin' | 'Geo', custom?: Partial<QuestieCustomization>) {
  const cfg: QuestieCustomization = {
    ...defaultQuestieCustomization(name),
    ...custom,
    preset: custom?.preset ?? name,
  };
  const pin = cfg.preset === 'Pin';
  const depth = clampNum(cfg.parallaxDepth, 0.5, 1.6);
  const eyeTrack = clampNum(cfg.eyeTrackingRange, 0.6, 1.4);
  const breathScale = clampNum(cfg.breathingScale, 0.5, 1.6);
  const eyeScale = clampNum(cfg.eyeScale, 0.85, 1.2);
  const irisScale = clampNum(cfg.irisScale, 0.85, 1.2);
  const mouthScale = clampNum(cfg.mouthScale, 0.8, 1.25);
  const browThickness = clampNum(cfg.browThickness, 1.3, 3.2);
  const browArch = clampNum(cfg.browArch, -3, 3);
  const glossOpacity = clampNum(cfg.glossOpacity, 0, 1);

  const doc = newDoc(name);
  const ab = doc.artboards[0]!;
  ab.artboard.props.width = 128;
  ab.artboard.props.height = 136;
  ab.animations = [];
  ab.stateMachines = [];

  for (const [propName, value] of Object.entries(GUIDE_PROPERTIES)) {
    addDataProperty(doc, { name: propName, type: 'number', value, viewModel: 'GuideVM' });
  }

  // The native Rive stream associates consecutive DataBindContext objects
  // with the preceding component. Install these after all drawing operations,
  // since later insertions can otherwise separate a bind from its owner.
  const pending: Array<{ target: CoreObj; propertyKey: number; source: GuideProperty }> = [];
  const bind = (target: CoreObj, propertyKey: number, source: GuideProperty) =>
    pending.push({ target, propertyKey, source });

  // Perceptually hue-shifted physical 3D matte-vinyl material palette derived from character identity colors
  const base = cfg.shellColor;
  const edge = cfg.shellEdge;
  const hi = cfg.shellLight;
  const warmTop = mixHex(hi, '#fff9f4', 0.46);
  const litMid = mixHex(hi, base, 0.54);
  const shadowMid = mixHex(base, edge, 0.56);
  const deepShadow = mixHex(shadeHex(edge, 0.56), pin ? '#28120c' : '#141226', 0.30);
  const rimBounce = mixHex(hi, pin ? '#ffe0c8' : '#aefcf0', 0.52);
  const bounceTint = mixHex(edge, rimBounce, 0.42);
  const lashInk = mixHex(deepShadow, '#161420', 0.58);
  const browInk = pin ? mixHex(edge, '#561e10', 0.48) : lashInk;

  const backpackDark = shadeHex(cfg.backpackColor, 0.56);
  const backpackMid = shadeHex(cfg.backpackColor, 0.84);
  const backpackLight = mixHex(cfg.backpackColor, '#fff1cf', 0.40);

  const scleraMid = mixHex(cfg.scleraColor, '#e6dfd8', 0.34);
  const scleraRim = mixHex(cfg.scleraColor, '#b2a8b6', 0.46);
  const irisDeep = mixHex(shadeHex(cfg.irisColor, 0.44), '#09101a', 0.38);
  const irisLuminous = mixHex(cfg.irisRingColor, '#e2fcff', 0.38);

  // Transparent artboard background so Pin & Geo float seamlessly on any host backdrop
  defineColor(doc, 'Background', '#0c151f00');
  applyThemeColor(doc, ab.artboard.id, 'Background');
  defineColor(doc, 'Shell', base);
  defineColor(doc, 'Shell Edge', edge);
  defineColor(doc, 'Shell Light', hi);

  const g = (nodeName: string, x: number, y: number, parent?: string) =>
    addGroup(doc, { name: nodeName, x, y, parent });
  const e = (
    nodeName: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string | null,
    parent?: string,
  ) => addShape(doc, { name: nodeName, kind: 'ellipse', x, y, width, height, fill, parent });
  const r = (
    nodeName: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string | null,
    cornerRadius: number,
    parent?: string,
  ) => addShape(doc, { name: nodeName, kind: 'rectangle', x, y, width, height, fill, cornerRadius, parent });

  const addClip = (clippedNode: CoreObj, sourceShape: CoreObj) => {
    const clip = obj('ClippingShape', {
      parentId: clippedNode.id,
      sourceId: sourceShape.id,
      fillRule: 0,
      isVisible: true,
    });
    ab.objects.push(clip);
    return clip;
  };

  const addRadialFill = (
    shape: CoreObj,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    stops: Array<[number, string]>,
    opacity = 1,
  ) => {
    const fill = obj('Fill', { parentId: shape.id });
    const grad = obj('RadialGradient', { parentId: fill.id, startX, startY, endX, endY, opacity });
    const stopObjs = stops.map(([position, color]) =>
      obj('GradientStop', { parentId: grad.id, colorValue: parseColor(color), position }),
    );
    ab.objects.push(fill, grad, ...stopObjs);
    return grad;
  };

  const addLinearFill = (
    shape: CoreObj,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    stops: Array<[number, string]>,
    opacity = 1,
  ) => {
    const fill = obj('Fill', { parentId: shape.id });
    const grad = obj('LinearGradient', { parentId: fill.id, startX, startY, endX, endY, opacity });
    const stopObjs = stops.map(([position, color]) =>
      obj('GradientStop', { parentId: grad.id, colorValue: parseColor(color), position }),
    );
    ab.objects.push(fill, grad, ...stopObjs);
    return grad;
  };

  const setRoundStroke = (shape: CoreObj) => {
    const stroke = ab.objects.find((o) => o.type === 'Stroke' && o.props.parentId === shape.id);
    if (stroke) {
      stroke.props.cap = 1;
      stroke.props.join = 1;
    }
  };

  // A scaled parent and inverse-scaled child convert normalized GuideVM positions
  // to drawing units while leaving artwork size unchanged.
  const shift = (
    nodeName: string,
    parent: string,
    xf: number,
    yf: number,
    x?: GuideProperty,
    y?: GuideProperty,
  ) => {
    const wrapper = g(nodeName + ' units', 0, 0, parent);
    wrapper.props.scaleX = xf;
    wrapper.props.scaleY = yf;
    const delta = g(nodeName + ' delta', 0, 0, nodeName + ' units');
    if (x) bind(delta, 13, x);
    if (y) bind(delta, 14, y);
    const art = g(nodeName + ' artwork', 0, 0, nodeName + ' delta');
    art.props.scaleX = 1 / xf;
    art.props.scaleY = 1 / yf;
    return nodeName + ' artwork';
  };

  // Clean 4-layer non-competing transform chain per depth plane:
  //   GuideVM (breath + headX/Y) -> `<name> weight` (11.7s WeightShift layer)
  //   -> `<name> idle` (7.3s Idle Breathe layer) -> `<name> motion` (Emotion layer)
  const moving = (nodeName: string, xf: number, yf: number, bf: number, head = false) => {
    const root = g(nodeName + ' parallax', 64, pin ? 76.0 : 70);
    if (pin) {
      root.props.scaleX = 1.03;
      root.props.scaleY = 1.03;
    }
    const breathed = shift(nodeName + ' breath', nodeName + ' parallax', 1, bf * breathScale, undefined, 'breath');
    const parent = head ? shift(nodeName + ' head', breathed, xf * depth, yf * depth, 'headX', 'headY') : breathed;
    g(nodeName + ' weight', 0, 0, parent);
    g(nodeName + ' idle', 0, 0, nodeName + ' weight');
    g(nodeName + ' motion', 0, 0, nodeName + ' idle');
  };

  // Ordered back-to-front; OpenRive inserts new drawables in front of older ones.
  // 1. Soft ambient ground contact shadow (richer grounding for compact circular presentation)
  const shadow = e('Ground shadow', 64, pin ? 123.5 : 118.5, 86, 13.5, null);
  addRadialFill(shadow, 0, 0, 43, 0, [
    [0, '#040a1472'],
    [0.36, '#06101c42'],
    [0.7, '#08152018'],
    [1, '#08152000'],
  ]);

  // Plane 1: Cushy torso-focused grounded boots/feet & portrait explorer backpack
  moving('Body', 0.58, 0.34, 0.42, true);

  for (const [side, x, rot] of [['L', -15.6, -4], ['R', 15.6, 4]] as const) {
    const footGroup = g('Foot group ' + side, x, 35.8, 'Body motion');
    footGroup.props.rotation = (rot * Math.PI) / 180;
    const foot = e('Foot ' + side, 0, 0, 19.6, 12.2, null, 'Foot group ' + side);
    addRadialFill(foot, side === 'L' ? -3.8 : -2.4, -3.8, 12.2, 8.8, [
      [0, warmTop],
      [0.2, litMid],
      [0.5, base],
      [0.8, edge],
      [1, deepShadow],
    ]);
    const footLightClip = g('Foot clip ' + side, 0, 0, 'Foot group ' + side);
    addClip(footLightClip, foot);
    const footKey = e('Foot sheen ' + side, -2.8, -2.8, 12.0, 5.6, null, 'Foot clip ' + side);
    addRadialFill(footKey, -1, -1, 6.4, 3.0, [
      [0, hexWithAlpha(warmTop, '7e')],
      [0.55, hexWithAlpha(hi, '20')],
      [1, hexWithAlpha(hi, '00')],
    ]);
    const footContactAO = e('Foot AO ' + side, side === 'L' ? 3.8 : -3.8, -3.8, 13.0, 6.4, null, 'Foot clip ' + side);
    addRadialFill(footContactAO, 0, -1, 6.5, 3.2, [
      [0, hexWithAlpha(deepShadow, '5c')],
      [0.6, hexWithAlpha(edge, '1e')],
      [1, hexWithAlpha(edge, '00')],
    ]);
  }

  // Golden-tan leather explorer backpack (peeking symmetrically on Pin as in the portrait, inverse parallax for 3D turn)
  if (cfg.showBackpack) {
    const backpack = shift('Backpack parallax', 'Body motion', -2.7 * depth, -0.65 * depth, 'headX', 'headY');
    if (pin) {
      const packLeft = r('Backpack L', -31.0, 12.5, 16.5, 22.0, null, 7.2, backpack);
      addRadialFill(packLeft, 2, -8, 13, 17, [
        [0, backpackLight],
        [0.35, cfg.backpackColor],
        [0.75, backpackMid],
        [1, backpackDark],
      ]);
      const packLeftFlap = r('Backpack flap L', -31.5, 6.5, 14.8, 7.6, null, 3.8, backpack);
      addLinearFill(packLeftFlap, -6, -4, 6, 4, [
        [0, backpackLight],
        [0.58, cfg.backpackColor],
        [1, backpackMid],
      ]);
    }
    const packBody = r('Backpack', 30.8, 9.2, 18.8, 25.5, null, 8.2, backpack);
    addRadialFill(packBody, -5, -10, 15, 19, [
      [0, backpackLight],
      [0.35, cfg.backpackColor],
      [0.75, backpackMid],
      [1, backpackDark],
    ]);
    const packFlap = r('Backpack flap', 30.8, 1.8, 17.6, 8.8, null, 4.4, backpack);
    addLinearFill(packFlap, -7, -4.5, 7, 4.5, [
      [0, backpackLight],
      [0.55, cfg.backpackColor],
      [1, backpackMid],
    ]);
    const packStrap = r('Backpack strap', 30.8, 4.4, 11.4, 2.0, null, 1.0, backpack);
    addLinearFill(packStrap, -5, 0, 5, 0, [
      [0, '#fff2cb'],
      [0.6, '#f4cc7c'],
      [1, '#c69345'],
    ]);
    const packBuckle = r('Backpack buckle', 30.8, 5.6, 4.6, 3.8, null, 1.3, backpack);
    addLinearFill(packBuckle, -2.2, -1.8, 2.2, 1.8, [
      [0, '#fff4cf'],
      [0.5, '#f2c161'],
      [1, '#b67f2e'],
    ]);
  }

  // Plane 2: Sculpted Plush 3D Head/Body Shell, Antenna, Preserved Glowing Status Ball & Working Headphones
  moving('Head', 1.85, 0.95, 0.72, true);

  const haloAura = e('Halo aura', 0, -56.4, 41, 41, null, 'Head motion');
  addRadialFill(haloAura, 0, 0, 20.5, 0, [
    [0, hexWithAlpha(cfg.beaconColor, '6c')],
    [0.34, hexWithAlpha(cfg.beaconColor, '34')],
    [0.66, hexWithAlpha(cfg.beaconColor, '12')],
    [1, hexWithAlpha(cfg.beaconColor, '00')],
  ]);

  const antenna = r('Antenna', 0, -47.2, 5.2, 18.0, null, 2.6, 'Head motion');
  addLinearFill(antenna, -2.6, 0, 2.6, 0, [
    [0, warmTop],
    [0.24, litMid],
    [0.58, base],
    [1, edge],
  ]);
  // Portrait-accurate glossy rounded coral pedestal collar sitting atop Pin's crown
  const collar = r('Antenna collar', 0, -39.6, pin ? 16.2 : 13.2, pin ? 6.4 : 5.2, null, 3.2, 'Head motion');
  addLinearFill(collar, -8.1, -3.2, 8.1, 3.2, [
    [0, warmTop],
    [0.3, litMid],
    [0.65, base],
    [1, edge],
  ]);
  const collarShine = e('Antenna collar shine', -2.6, -41.4, 7.6, 2.0, null, 'Head motion');
  addRadialFill(collarShine, 0, 0, 4.0, 1.1, [
    [0, '#ffffff99'],
    [0.7, '#ffffff18'],
    [1, '#ffffff00'],
  ]);

  // Preserved round glowing status ball (solid fill animated by Emotion state machine + translucent 3D jewel overlay)
  e('Halo', 0, -56.4, 26.5, 26.5, hexWithAlpha(cfg.beaconColor, '36'), 'Head motion');
  e('Beacon', 0, -56.4, 17.8, 17.8, cfg.beaconColor, 'Head motion');
  const beaconDome = e('Beacon dome', 0, -56.4, 17.8, 17.8, null, 'Head motion');
  addRadialFill(beaconDome, -4.0, -4.6, 10.8, 10.8, [
    [0, '#fffffff4'],
    [0.24, '#ffffff6c'],
    [0.52, '#ffffff0c'],
    [0.82, '#00324228'],
    [1, '#0024346a'],
  ]);
  const beaconCaustic = e('Beacon caustic', 2.4, -52.6, 9.2, 6.2, null, 'Head motion');
  addRadialFill(beaconCaustic, 0, 0, 4.8, 3.2, [
    [0, '#c2fffb92'],
    [0.6, '#ffffff22'],
    [1, '#ffffff00'],
  ]);
  e('Beacon highlight', -3.3, -59.8, 5.1, 3.8, '#ffffff', 'Head motion').props.opacity = 0.98;

  // Sculpted Plush 3D Shell (zero flat outline stroke — pure volumetric 3D edge lighting!)
  // Pin keeps its unmistakable portrait teardrop map-pin crown & rounded cushion point; Geo keeps its plush tactile orb.
  const shell = pin
    ? addPath(doc, {
        parent: 'Head motion',
        name: 'Shell',
        fill: null,
        points: [
          { x: 0, y: -40.5, inX: -27.5, inY: 0, outX: 27.5, outY: 0 },
          { x: 38.8, y: -3.5, inX: 2.8, inY: -22.5, outX: -6.8, outY: 22.8 },
          { x: 0, y: 41.2, inX: 8.6, inY: 0, outX: -8.6, outY: 0 },
          { x: -38.8, y: -3.5, inX: 6.8, inY: 22.8, outX: -2.8, outY: -22.5 },
        ],
      })
    : addShape(doc, {
        parent: 'Head motion',
        name: 'Shell',
        kind: 'ellipse',
        x: 0,
        y: -1.5,
        width: 77.2,
        height: 77.6,
        fill: null,
      });

  addRadialFill(shell, -15, -24, 50, 52, [
    [0, warmTop],
    [0.18, litMid],
    [0.46, base],
    [0.74, shadowMid],
    [0.9, edge],
    [1, deepShadow],
  ]);

  // Clipped internal 3D sculptural lighting group (Pixar glazed-vinyl studio illumination, zero bands, zero spillover)
  const shellLightClip = g('Shell lighting clip', 0, 0, 'Head motion');
  addClip(shellLightClip, shell);

  // 1. Broad soft studio top-left key dome
  const domeKey = e('Shell dome key', -14, -22, 64, 52, null, 'Shell lighting clip');
  addRadialFill(domeKey, -6, -6, 32, 26, [
    [0, hexWithAlpha(warmTop, '7a')],
    [0.42, hexWithAlpha(hi, '30')],
    [0.74, hexWithAlpha(hi, '0a')],
    [1, hexWithAlpha(hi, '00')],
  ]);

  // 2. Sculpted core shadow hemisphere (rich warm-coral hue-shifted depth on lower-right curve)
  const coreShadow = e('Shell core shadow', 16, 20, 62, 54, null, 'Shell lighting clip');
  addRadialFill(coreShadow, 8, 10, 32, 28, [
    [0, hexWithAlpha(deepShadow, '58')],
    [0.48, hexWithAlpha(edge, '28')],
    [1, hexWithAlpha(edge, '00')],
  ]);

  // 3. Soft subsurface rim bounce along lower contour (lifts 3D plushness off compact circular backdrops)
  const bounceLight = e('Shell bounce', -18, 24, 52, 44, null, 'Shell lighting clip');
  addRadialFill(bounceLight, -8, 10, 26, 22, [
    [0, hexWithAlpha(bounceTint, '66')],
    [0.54, hexWithAlpha(bounceTint, '1e')],
    [1, hexWithAlpha(bounceTint, '00')],
  ]);

  // 4. Studio back-rim hair light along right crown edge
  const edgeRim = e('Shell edge rim', 27, -18, 34, 46, null, 'Shell lighting clip');
  addRadialFill(edgeRim, 10, -6, 17, 23, [
    [0, hexWithAlpha(rimBounce, '68')],
    [0.52, hexWithAlpha(hi, '1c')],
    [1, hexWithAlpha(hi, '00')],
  ]);

  // 5. Colored ambient spill light cast onto top crown directly below glowing status ball
  const beaconSpill = e('Beacon spill', 0, -35.5, 34, 14, null, 'Shell lighting clip');
  addRadialFill(beaconSpill, 0, -4, 17, 7, [
    [0, hexWithAlpha(cfg.beaconColor, '3a')],
    [0.52, hexWithAlpha(cfg.beaconColor, '12')],
    [1, hexWithAlpha(cfg.beaconColor, '00')],
  ]);

  // 6. Soft collar ambient occlusion directly under antenna base
  const collarAO = e('Collar AO', 0, -38.5, 18.5, 5.2, null, 'Shell lighting clip');
  addRadialFill(collarAO, 0, -0.8, 9.2, 2.6, [
    [0, hexWithAlpha(deepShadow, '48')],
    [0.55, hexWithAlpha(edge, '16')],
    [1, hexWithAlpha(edge, '00')],
  ]);

  // 7. Glossy curved outer-hood rim specular gleam (signature glazed-ceramic Pixar sheen from Pin portraits!)
  const sheen = addPath(doc, {
    parent: 'Shell lighting clip',
    name: 'Shell sheen',
    fill: null,
    points: [
      { x: -29.5, y: -16.5, inX: -2.5, inY: 6.5, outX: 4.5, outY: -12.0 },
      { x: -1.5, y: -36.8, inX: -14.5, inY: -1.2, outX: 11.5, outY: 1.0 },
      { x: 22.0, y: -26.2, inX: -4.5, inY: -5.2, outX: 3.0, outY: 4.0 },
      { x: 18.5, y: -23.0, inX: 1.5, inY: -2.5, outX: -6.0, outY: -6.5 },
      { x: -1.5, y: -32.6, inX: 9.0, inY: 0.4, outX: -12.0, outY: -0.6 },
      { x: -25.4, y: -14.8, inX: 2.8, inY: -9.0, outX: -3.5, outY: 2.5 },
    ],
  });
  addRadialFill(
    sheen,
    -6.5,
    -33.5,
    30,
    -18,
    [
      [0, '#ffffff6c'],
      [0.48, hexWithAlpha(warmTop, '38')],
      [0.82, hexWithAlpha(hi, '12')],
      [1, hexWithAlpha(hi, '00')],
    ],
    glossOpacity,
  );

  // Soft ambient occlusion shadows where arms join torso (grounds overlapping plush limbs in 3D space)
  for (const [side, ax] of [['L', -34.2], ['R', 34.2]] as const) {
    const shAO = e('Shoulder AO ' + side, ax, 5.8, 14.8, 18.6, null, 'Shell lighting clip');
    addRadialFill(shAO, side === 'L' ? 2.4 : -2.4, 0, 7.6, 9.4, [
      [0, hexWithAlpha(deepShadow, '4a')],
      [0.52, hexWithAlpha(edge, '1c')],
      [1, hexWithAlpha(edge, '00')],
    ]);
  }

  // Portrait-faithful sculpted inner facial cushion rim & connected golden explorer accessories (Pin identity!)
  if (pin) {
    // Sculpted recessed oval groove separating the outer glossy coral map-pin bezel from Pin's plush inner face dome
    const faceCushionAO = e('Face cushion AO', 0, -6.4, 62.0, 56.8, null, 'Shell lighting clip');
    addRadialFill(faceCushionAO, 0, 2.2, 31.4, 28.8, [
      [0, hexWithAlpha(base, '00')],
      [0.78, hexWithAlpha(edge, '12')],
      [0.91, hexWithAlpha(deepShadow, '52')],
      [0.97, hexWithAlpha(deepShadow, '24')],
      [1, hexWithAlpha(deepShadow, '00')],
    ]);
    // Plump convex inner face cushion with smooth glossy coral-orange dome (zero milky haze!)
    const faceCushionDome = e('Face cushion dome', 0, -6.8, 57.4, 52.0, null, 'Shell lighting clip');
    addRadialFill(faceCushionDome, -10, -14, 32, 30, [
      [0, litMid],
      [0.36, base],
      [0.76, shadowMid],
      [0.94, edge],
      [1, hexWithAlpha(deepShadow, '44')],
    ]);
    // Soft luminous specular highlight tucked cleanly on Pin's inner upper forehead just like IMG_2945
    const foreheadGlint = e('Forehead gloss', -10.5, -26.5, 18.0, 6.2, null, 'Shell lighting clip');
    foreheadGlint.props.rotation = (-10 * Math.PI) / 180;
    addRadialFill(foreheadGlint, 0, 0, 9.2, 3.2, [
      [0, '#ffffff48'],
      [0.55, hexWithAlpha(warmTop, '22')],
      [1, hexWithAlpha(warmTop, '00')],
    ]);

    // Portrait-accurate curved golden-tan leather backpack straps hugging Pin's chest curve with buckle loop
    for (const [side, sx, rot] of [['L', -20.5, -24], ['R', 20.5, 24]] as const) {
      const strapG = g('Shoulder strap ' + side, sx, 17.5, 'Shell lighting clip');
      strapG.props.rotation = (rot * Math.PI) / 180;
      const strapShadow = r('Strap AO ' + side, side === 'L' ? 0.9 : -0.9, 0.8, 5.8, 22.0, null, 2.9, 'Shoulder strap ' + side);
      addRadialFill(strapShadow, 0, 0, 3.4, 11.2, [
        [0, hexWithAlpha(deepShadow, '46')],
        [1, hexWithAlpha(deepShadow, '00')],
      ]);
      const strap = r('Strap mesh ' + side, 0, 0, 5.0, 21.4, null, 2.5, 'Shoulder strap ' + side);
      addLinearFill(strap, -2.5, 0, 2.5, 0, [
        [0, backpackLight],
        [0.42, cfg.backpackColor],
        [0.85, backpackMid],
        [1, backpackDark],
      ]);
      const buckle = r('Strap buckle ' + side, 0, 1.5, 5.8, 3.0, null, 1.0, 'Shoulder strap ' + side);
      addLinearFill(buckle, -2.9, -1.5, 2.9, 1.5, [
        [0, '#fff2c2'],
        [0.5, '#e6b249'],
        [1, '#9c661c'],
      ]);
    }

    // Iconic Golden Compass Medallion on V-lanyard connecting cleanly from both shoulder straps
    const compassGroup = g('Compass medallion', 0, 25.0, 'Shell lighting clip');
    const lanyardShadow = addPath(doc, {
      parent: 'Compass medallion',
      name: 'Compass lanyard shadow',
      closed: false,
      fill: null,
      stroke: hexWithAlpha(deepShadow, '40'),
      strokeWidth: 3.4,
      points: [
        { x: -17.5, y: -11.4, outX: 5.2, outY: 4.8 },
        { x: 0, y: -5.2, inX: -3.2, inY: -1.8, outX: 3.2, outY: -1.8 },
        { x: 17.5, y: -11.4, inX: -5.2, inY: 4.8 },
      ],
    });
    setRoundStroke(lanyardShadow);
    const lanyard = addPath(doc, {
      parent: 'Compass medallion',
      name: 'Compass lanyard',
      closed: false,
      fill: null,
      stroke: cfg.backpackColor,
      strokeWidth: 2.6,
      points: [
        { x: -17.5, y: -12.2, outX: 5.2, outY: 4.8 },
        { x: 0, y: -6.0, inX: -3.2, inY: -1.8, outX: 3.2, outY: -1.8 },
        { x: 17.5, y: -12.2, inX: -5.2, inY: 4.8 },
      ],
    });
    setRoundStroke(lanyard);
    const bail = e('Compass bail', 0, -6.2, 3.6, 3.6, null, 'Compass medallion');
    addLinearFill(bail, -1.8, -1.8, 1.8, 1.8, [
      [0, '#fff3c4'],
      [0.5, '#e5b347'],
      [1, '#8c5a18'],
    ]);
    const compassAO = e('Compass AO', 0, 1.5, 14.8, 14.2, null, 'Compass medallion');
    addRadialFill(compassAO, 0, 0, 7.4, 7.1, [
      [0, hexWithAlpha(deepShadow, '5c')],
      [0.65, hexWithAlpha(deepShadow, '20')],
      [1, hexWithAlpha(deepShadow, '00')],
    ]);
    const compassRim = e('Compass rim', 0, 0, 13.4, 13.4, null, 'Compass medallion');
    addLinearFill(compassRim, -5.2, -6.2, 6.2, 6.2, [
      [0, '#fff5cc'],
      [0.32, '#eab74b'],
      [0.74, '#b87c24'],
      [1, '#794a10'],
    ]);
    const compassFace = e('Compass face', 0, 0, 10.2, 10.2, null, 'Compass medallion');
    addRadialFill(compassFace, -1.5, -1.5, 5.4, 5.4, [
      [0, '#fffbf0'],
      [0.72, '#f5e4bc'],
      [1, '#d8bc84'],
    ]);
    // Crisp 4-point colorful compass rose (vivid turquoise N/S + warm coral-gold E/W)
    addPath(doc, {
      parent: 'Compass medallion',
      name: 'Compass star NS',
      fill: '#16b9bc',
      points: [
        { x: 0, y: -4.1 },
        { x: 1.4, y: 0 },
        { x: 0, y: 4.1 },
        { x: -1.4, y: 0 },
      ],
    });
    addPath(doc, {
      parent: 'Compass medallion',
      name: 'Compass star EW',
      fill: '#f06d42',
      points: [
        { x: -3.8, y: 0 },
        { x: 0, y: -1.3 },
        { x: 3.8, y: 0 },
        { x: 0, y: 1.3 },
      ],
    });
    e('Compass center', 0, 0, 2.4, 2.4, '#ffd966', 'Compass medallion');
  }

  // Soft lower-torso ambient occlusion cast by the open miniature laptop deck
  const laptopTorsoAO = e('Laptop torso AO', 0, 29.5, 52, 19, null, 'Shell lighting clip');
  addRadialFill(laptopTorsoAO, 0, 0, 26, 9.5, [
    [0, hexWithAlpha(deepShadow, '64')],
    [0.55, hexWithAlpha(deepShadow, '28')],
    [1, hexWithAlpha(deepShadow, '00')],
  ]);
  laptopTorsoAO.props.opacity = 0;

  // Subtle upward laptop screen glow cast onto Pin/Geo's lower face during WORK-THINK & TYPE-PONDER
  const laptopFaceGlow = e('Laptop face glow', 0, 12.8, 58, 38, null, 'Shell lighting clip');
  addRadialFill(laptopFaceGlow, 0, 8, 29, 19, [
    [0, '#b8f0ff78'],
    [0.48, '#88ccff34'],
    [1, '#88ccff00'],
  ]);
  laptopFaceGlow.props.opacity = 0;

  // Articulated Over-Ear Working Headphones (Native inside .riv! Glides on smoothly during WORK-THINK & TYPE-PONDER)
  // Warm satin-silver & soft matte-charcoal finish inspired by the Kendo/Muse studio headphones.
  const headphonesRig = g('Headphones rig', 0, -14, 'Head motion');
  headphonesRig.props.opacity = 0;
  headphonesRig.props.scaleX = 0.92;
  headphonesRig.props.scaleY = 0.92;

  const hpBandShadow = addPath(doc, {
    parent: 'Headphones rig',
    name: 'Headphone band shadow',
    closed: false,
    fill: null,
    stroke: '#0a0f185a',
    strokeWidth: 7.4,
    points: [
      { x: -39.0, y: -11.5, outX: -0.5, outY: -23.5 },
      { x: 0, y: -40.4, inX: -24.5, inY: 0, outX: 24.5, outY: 0 },
      { x: 39.0, y: -11.5, inX: 0.5, inY: -23.5 },
    ],
  });
  setRoundStroke(hpBandShadow);

  const hpBand = addPath(doc, {
    parent: 'Headphones rig',
    name: 'Headphone band',
    closed: false,
    fill: null,
    stroke: '#3c4654',
    strokeWidth: 5.4,
    points: [
      { x: -39.0, y: -12.5, outX: -0.5, outY: -23.5 },
      { x: 0, y: -41.2, inX: -24.5, inY: 0, outX: 24.5, outY: 0 },
      { x: 39.0, y: -12.5, inX: 0.5, inY: -23.5 },
    ],
  });
  setRoundStroke(hpBand);

  const hpBandHighlight = addPath(doc, {
    parent: 'Headphones rig',
    name: 'Headphone band highlight',
    closed: false,
    fill: null,
    stroke: '#b6c3d499',
    strokeWidth: 1.7,
    points: [
      { x: -33.0, y: -24.2, outX: 4.5, outY: -12.2 },
      { x: 0, y: -42.4, inX: -19.0, inY: 0, outX: 19.0, outY: 0 },
      { x: 29.5, y: -26.2, inX: -4.0, inY: -10.8 },
    ],
  });
  setRoundStroke(hpBandHighlight);

  // Volumetric left & right over-ear cushions, satin-silver/graphite outer shells, and luminous status LED accents
  for (const [side, sx, tilt] of [
    ['L', -39.0, -5],
    ['R', 39.0, 5],
  ] as const) {
    const sign = side === 'L' ? -1 : 1;
    const cupGroup = g('Headphone cup ' + side, sx, -8.2, 'Headphones rig');
    cupGroup.props.rotation = (tilt * Math.PI) / 180;

    const hpAO = e('HP AO ' + side, -sign * 2.2, 0.8, 9.5, 24.5, null, 'Headphone cup ' + side);
    addRadialFill(hpAO, 0, 0, 5.0, 12.2, [
      [0, hexWithAlpha(deepShadow, '60')],
      [0.6, hexWithAlpha(deepShadow, '1e')],
      [1, hexWithAlpha(deepShadow, '00')],
    ]);

    const hpPad = r('HP pad ' + side, -sign * 1.4, 0, 7.2, 22.0, null, 3.6, 'Headphone cup ' + side);
    addLinearFill(hpPad, 0, -11, 0, 11, [
      [0, '#4a5564'],
      [0.35, '#2c3542'],
      [0.8, '#1a202a'],
      [1, '#10151c'],
    ]);

    const hpShell = r('HP shell ' + side, sign * 2.1, 0, 8.2, 18.4, null, 4.1, 'Headphone cup ' + side);
    addLinearFill(hpShell, -4.1, -9.2, 4.1, 9.2, [
      [0, '#d0d8e2'],
      [0.28, '#8d9aab'],
      [0.72, '#4a5666'],
      [1, '#262f3b'],
    ]);

    const hpLed = r('HP led ' + side, sign * 3.8, 0, 2.2, 9.4, cfg.beaconColor, 1.1, 'Headphone cup ' + side);
    hpLed.props.opacity = 0.92;
  }

  // Plane 3: Mid-face soft sculptural cheek warmth & speaking glow
  moving('MidFace', 3.05, 1.5, 0.8, true);
  for (const [side, x] of [['L', -22.4], ['R', 22.4]] as const) {
    const cheek = e('Cheek ' + side, x, 2.0, 14.8, 8.6, null, 'MidFace motion');
    addRadialFill(cheek, 0, 0, 7.6, 0, [
      [0, hexWithAlpha(cfg.blushColor, '86')],
      [0.48, hexWithAlpha(cfg.blushColor, '38')],
      [0.82, hexWithAlpha(cfg.blushColor, '0e')],
      [1, hexWithAlpha(cfg.blushColor, '00')],
    ]);
    const blush = e('Speech blush ' + side, x, 2.0, 16.5, 9.6, null, 'MidFace motion');
    addRadialFill(blush, 0, 0, 8.4, 0, [
      [0, hexWithAlpha(cfg.blushColor, '66')],
      [0.55, hexWithAlpha(cfg.blushColor, '22')],
      [1, hexWithAlpha(cfg.blushColor, '00')],
    ]);
    blush.props.opacity = 0;
    bind(blush, 18, 'speaking');
  }

  // Plane 4: Foreground expressive face plane (high 3D differential parallax)
  moving('Face', 4.25, 2.2, 0.86, true);

  for (const [side, x] of [['L', -14.0], ['R', 14.0]] as const) {
    const browLift = shift('Brow lift ' + side, 'Face motion', 0.42 * eyeTrack, 1.3 * eyeTrack, 'lookX', 'lookY');
    // Dedicated independent brow microexpression node (driven by 13.9s AutoGaze layer)
    g('Brow micro ' + side, 0, 0, browLift);
    g('Brow rig ' + side, x, -25.8, 'Brow micro ' + side);
    const archY = -4.2 - browArch;
    // Soft brow ambient shadow grounds the sculpted 3D brow ridge onto Pin's forehead
    const browShadow = addPath(doc, {
      parent: 'Brow rig ' + side,
      name: 'Brow shadow ' + side,
      x: 0,
      y: 1.1,
      closed: false,
      fill: null,
      stroke: hexWithAlpha(deepShadow, '3e'),
      strokeWidth: browThickness + 1.1,
      points: [
        { x: -6.2, y: 0.6, outX: 3.0, outY: archY },
        { x: 6.2, y: 0.6, inX: -3.0, inY: archY },
      ],
    });
    setRoundStroke(browShadow);
    const browShape = addPath(doc, {
      parent: 'Brow rig ' + side,
      name: 'Brow ' + side,
      x: 0,
      y: 0,
      closed: false,
      fill: null,
      stroke: pin ? '#a63c1c' : browInk,
      strokeWidth: browThickness,
      points: [
        { x: -6.2, y: 0.6, outX: 3.0, outY: archY },
        { x: 6.2, y: 0.6, inX: -3.0, inY: archY },
      ],
    });
    setRoundStroke(browShape);
    if (pin) {
      const browGlint = addPath(doc, {
        parent: 'Brow rig ' + side,
        name: 'Brow highlight ' + side,
        x: 0,
        y: -0.55,
        closed: false,
        fill: null,
        stroke: hexWithAlpha(warmTop, '42'),
        strokeWidth: 0.85,
        points: [
          { x: -4.2, y: -0.1, outX: 2.0, outY: archY * 0.65 },
          { x: 4.2, y: -0.1, inX: -2.0, inY: archY * 0.65 },
        ],
      });
      setRoundStroke(browGlint);
    }

    const eyeGroup = g('Eye ' + side, x, -10.8, 'Face motion');
    eyeGroup.props.scaleX = eyeScale;
    eyeGroup.props.scaleY = eyeScale;

    const socket = e('Eye socket ' + side, 0, -0.5, 25.4, 26.8, null, 'Eye ' + side);
    addRadialFill(socket, 0, -1.5, 13.0, 13.8, [
      [0, hexWithAlpha(deepShadow, '58')],
      [0.54, hexWithAlpha(deepShadow, '28')],
      [0.82, hexWithAlpha(edge, '10')],
      [1, hexWithAlpha(edge, '00')],
    ]);

    const underRim = e('Eye under rim ' + side, 0, 9.8, 16.4, 4.8, null, 'Eye ' + side);
    addRadialFill(underRim, 0, 1, 8.4, 2.4, [
      [0, hexWithAlpha(warmTop, '46')],
      [0.65, hexWithAlpha(hi, '12')],
      [1, hexWithAlpha(hi, '00')],
    ]);

    const sclera = e('Sclera ' + side, 0, 0, 19.2, 20.8, null, 'Eye ' + side);
    addRadialFill(sclera, -2.0, 1.4, 11.4, 12.2, [
      [0, cfg.scleraColor],
      [0.62, cfg.scleraColor],
      [0.86, scleraMid],
      [1, scleraRim],
    ]);

    // Clipped eye interior: native gaze + GuideVM pupil + native AutoBlink + GuideVM blink
    const eyeClip = g('Eye interior ' + side, 0, 0, 'Eye ' + side);
    addClip(eyeClip, sclera);

    // Native autonomous gaze node (runs in any standalone Rive player with zero JS!)
    // Nested above GuideVM Pupil shift so interactive tracking composes seamlessly on top.
    g('Native gaze ' + side, 0, 0, 'Eye interior ' + side);
    const pupil = shift('Pupil ' + side, 'Native gaze ' + side, 3.25 * eyeTrack, 2.35 * eyeTrack, 'lookX', 'lookY');
    const irisRig = g('Iris rig ' + side, 0, 0.7, pupil);
    irisRig.props.scaleX = irisScale;
    irisRig.props.scaleY = irisScale;

    // Soulful Pixar Pin iris: rich deep midnight-navy upper iris transitioning to glowing turquoise-teal crescent
    const irisLimbal = e('Iris limbal ' + side, 0, 0, 12.6, 14.0, null, 'Iris rig ' + side);
    addRadialFill(irisLimbal, 0, 0, 6.8, 7.2, [
      [0, cfg.irisColor],
      [0.72, irisDeep],
      [1, '#051120f0'],
    ]);

    const iris = e('Iris ' + side, 0, 0.3, 11.6, 13.0, null, 'Iris rig ' + side);
    addRadialFill(iris, 0, 3.6, 7.2, 7.8, [
      [0, '#4ef8ee'],
      [0.32, cfg.irisRingColor],
      [0.64, cfg.irisColor],
      [1, '#07182c'],
    ]);

    const irisHalo = e('Iris halo ' + side, 0, 2.5, 8.2, 6.8, null, 'Iris rig ' + side);
    addRadialFill(irisHalo, 0, 1.4, 4.4, 3.6, [
      [0, '#72fff7b0'],
      [0.55, hexWithAlpha(cfg.irisRingColor, '38')],
      [1, hexWithAlpha(cfg.irisRingColor, '00')],
    ]);

    const pupilCore = e('Pupil core ' + side, 0, -0.6, 6.8, 7.8, null, 'Iris rig ' + side);
    addRadialFill(pupilCore, 0, -0.4, 3.8, 4.2, [
      [0, '#040a14'],
      [0.74, '#081524'],
      [1, hexWithAlpha(irisDeep, 'd4')],
    ]);

    if (cfg.glintStyle === 'muse') {
      const mainGlint = e('Eye glint ' + side, -2.5, -2.9, 4.4, 3.9, '#ffffff', 'Iris rig ' + side);
      mainGlint.props.rotation = (-18 * Math.PI) / 180;
      e('Eye glint small ' + side, 2.3, 2.9, 1.9, 1.85, '#ecffff', 'Iris rig ' + side).props.opacity = 0.96;
      const lowerCaustic = e('Eye catchlight ' + side, 0.2, 4.6, 5.2, 1.8, null, 'Iris rig ' + side);
      addRadialFill(lowerCaustic, 0, 0, 2.8, 1.0, [
        [0, '#ffffffcc'],
        [0.55, '#52fff6aa'],
        [1, '#52fff600'],
      ]);
    } else if (cfg.glintStyle === 'studio') {
      const studioGlint = e('Eye glint ' + side, -1.9, -2.6, 5.0, 3.0, '#ffffff', 'Iris rig ' + side);
      studioGlint.props.rotation = (-22 * Math.PI) / 180;
      studioGlint.props.opacity = 0.92;
      e('Eye glint small ' + side, 2.4, 2.8, 1.5, 1.5, '#ebfcff', 'Iris rig ' + side).props.opacity = 0.8;
    } else {
      e('Eye glint ' + side, -2.0, -2.4, 3.8, 3.8, '#ffffff', 'Iris rig ' + side);
      e('Eye glint small ' + side, 2.1, 3.2, 1.5, 1.5, '#b6dce6', 'Iris rig ' + side);
    }

    const topEyeShadow = e('Eye top shadow ' + side, 0, -10.0, 22, 7.6, null, 'Eye interior ' + side);
    addRadialFill(topEyeShadow, 0, -2, 11, 4.4, [
      [0, hexWithAlpha(deepShadow, '3e')],
      [0.65, hexWithAlpha(deepShadow, '10')],
      [1, hexWithAlpha(deepShadow, '00')],
    ]);

    // Anatomical Lower Cheek-Lid: native AutoBlink node + GuideVM `blink` shift (drawn below upper lid)
    g('Lower lid auto ' + side, 0, 0, 'Eye interior ' + side);
    const lowerLidArt = shift('Lower lid ' + side, 'Lower lid auto ' + side, 1, -8.8, undefined, 'blink');
    const lowerLidShape = addPath(doc, {
      parent: lowerLidArt,
      name: 'Lower lid cover ' + side,
      fill: null,
      points: [
        { x: -13, y: 11.4, inX: 0, inY: 0, outX: 4.4, outY: -1.6 },
        { x: 0, y: 10.6, inX: -5.2, inY: 0, outX: 5.2, outY: 0 },
        { x: 13, y: 11.4, inX: -4.4, inY: -1.6, outX: 0, outY: 0 },
        { x: 13, y: 27, inX: 0, inY: 0, outX: 0, outY: 0 },
        { x: -13, y: 27, inX: 0, inY: 0, outX: 0, outY: 0 },
      ],
    });
    addRadialFill(lowerLidShape, -2, 12, 12, 21, [
      [0, litMid],
      [0.5, base],
      [1, edge],
    ]);

    // Anatomical Upper Eyelid: native AutoBlink node + GuideVM `blink` shift (curved organic lash on top!)
    g('Upper lid auto ' + side, 0, 0, 'Eye interior ' + side);
    const upperLidArt = shift('Upper lid ' + side, 'Upper lid auto ' + side, 1, 15.8, undefined, 'blink');
    const upperLidShape = addPath(doc, {
      parent: upperLidArt,
      name: 'Upper lid cover ' + side,
      fill: null,
      points: [
        { x: -13, y: -34, inX: 0, inY: 0, outX: 0, outY: 0 },
        { x: 13, y: -34, inX: 0, inY: 0, outX: 0, outY: 0 },
        { x: 13, y: -14.2, inX: 0, inY: 0, outX: -4.5, outY: 1.8 },
        { x: 0, y: -13.1, inX: 5.5, inY: 0, outX: -5.5, outY: 0 },
        { x: -13, y: -14.2, inX: 4.5, inY: 1.8, outX: 0, outY: 0 },
      ],
    });
    addRadialFill(upperLidShape, -3, -24, 14, -9, [
      [0, litMid],
      [0.45, base],
      [0.85, shadowMid],
      [1, edge],
    ]);
    const upperLash = addPath(doc, {
      parent: upperLidArt,
      name: 'Upper lash ' + side,
      closed: false,
      fill: null,
      stroke: lashInk,
      strokeWidth: 1.85,
      points: [
        { x: -9.8, y: -14.0, outX: 3.4, outY: 1.5 },
        { x: 0, y: -12.9, inX: -3.5, inY: 0, outX: 3.5, outY: 0 },
        { x: 9.8, y: -14.0, inX: -3.4, inY: 1.5 },
      ],
    });
    setRoundStroke(upperLash);

    // Signature Pin Portrait Espresso Upper Eye-Rim Arch + 3 Delicate Upturned Outer Lashes!
    if (pin) {
      const s = side === 'L' ? -1 : 1;
      const upperRimArch = addPath(doc, {
        parent: 'Eye ' + side,
        name: 'Eye lash rim ' + side,
        closed: false,
        fill: null,
        stroke: '#231311',
        strokeWidth: 1.55,
        points: [
          { x: -s * 7.2, y: -6.2, outX: s * 2.0, outY: -4.2 },
          { x: s * 0.6, y: -10.3, inX: -s * 4.4, inY: -0.2, outX: s * 5.2, outY: 0.4 },
          { x: s * 9.3, y: -2.2, inX: -s * 0.7, inY: -5.2 },
        ],
      });
      setRoundStroke(upperRimArch);
      const lash1 = addPath(doc, {
        parent: 'Eye ' + side,
        name: 'Outer lash A ' + side,
        closed: false,
        fill: null,
        stroke: '#231311',
        strokeWidth: 1.35,
        points: [
          { x: s * 7.6, y: -6.6, outX: s * 1.4, outY: -1.4 },
          { x: s * 10.6, y: -8.9 },
        ],
      });
      setRoundStroke(lash1);
      const lash2 = addPath(doc, {
        parent: 'Eye ' + side,
        name: 'Outer lash B ' + side,
        closed: false,
        fill: null,
        stroke: '#231311',
        strokeWidth: 1.3,
        points: [
          { x: s * 8.8, y: -4.0, outX: s * 1.6, outY: -0.9 },
          { x: s * 11.8, y: -5.4 },
        ],
      });
      setRoundStroke(lash2);
      const lash3 = addPath(doc, {
        parent: 'Eye ' + side,
        name: 'Outer lash C ' + side,
        closed: false,
        fill: null,
        stroke: '#231311',
        strokeWidth: 1.15,
        points: [
          { x: s * 9.4, y: -1.4, outX: s * 1.3, outY: -0.3 },
          { x: s * 11.7, y: -2.0 },
        ],
      });
      setRoundStroke(lash3);
    }
  }

  // Portrait-faithful sculpted 3D rounded button nose on Pin (sits right between eyes and joyful smile!)
  if (pin) {
    const noseShadow = e('Nose shadow', 0, 0.5, 7.8, 4.6, null, 'Face motion');
    addRadialFill(noseShadow, 0, 0.6, 4.0, 2.4, [
      [0, hexWithAlpha(deepShadow, '4a')],
      [0.62, hexWithAlpha(edge, '18')],
      [1, hexWithAlpha(edge, '00')],
    ]);
    const noseDome = e('Nose dome', 0, -0.9, 7.0, 5.0, null, 'Face motion');
    addRadialFill(noseDome, -1.3, -1.3, 4.0, 3.2, [
      [0, warmTop],
      [0.28, litMid],
      [0.66, base],
      [1, edge],
    ]);
    const noseGlint = e('Nose highlight', -1.2, -1.8, 2.8, 1.6, null, 'Face motion');
    addRadialFill(noseGlint, 0, 0, 1.5, 0.9, [
      [0, '#ffffffa4'],
      [0.65, hexWithAlpha(warmTop, '30')],
      [1, hexWithAlpha(warmTop, '00')],
    ]);
  }

  // Sculpted lower-lip cushion highlight + whisper-soft chin contour shadow beneath Pin's smile
  const chinDimple = e('Chin dimple', 0, 12.6, 12.2, 3.6, null, 'Face motion');
  addRadialFill(chinDimple, 0, 0, 6.2, 1.9, [
    [0, hexWithAlpha(deepShadow, '24')],
    [0.65, hexWithAlpha(edge, '0a')],
    [1, hexWithAlpha(edge, '00')],
  ]);
  if (pin) {
    const lowerLipShine = e('Lower lip shine', 0, 10.6, 8.6, 2.4, null, 'Face motion');
    addRadialFill(lowerLipShine, 0, 0, 4.4, 1.2, [
      [0, hexWithAlpha(warmTop, '5c')],
      [0.7, hexWithAlpha(warmTop, '16')],
      [1, hexWithAlpha(warmTop, '00')],
    ]);
  }

  // Continuous native smile-cup mouth rig bound to GuideVM mouthWide/mouthOpen/teeth/tongue
  // Sculpted tall upturned D-smile so resting Pin shows her signature warm portrait smile while all 8 Rhubarb visemes stay crisp!
  const mouthFrame = g('Mouth frame', 0, pin ? 6.2 : 4.8, 'Face motion');
  mouthFrame.props.scaleX = mouthScale;
  mouthFrame.props.scaleY = mouthScale;

  const mouth = g('Mouth rig', 0, 0, 'Mouth frame');
  mouth.props.scaleX = GUIDE_PROPERTIES.mouthWide;
  mouth.props.scaleY = GUIDE_PROPERTIES.mouthOpen;
  bind(mouth, 16, 'mouthWide');
  bind(mouth, 17, 'mouthOpen');

  const cavity = addPath(doc, {
    parent: 'Mouth rig',
    name: 'Mouth cavity',
    fill: null,
    stroke: hexWithAlpha(deepShadow, '88'),
    strokeWidth: 0.75,
    points: pin
      ? [
          { x: -11.4, y: -5.4, inX: -0.6, inY: 3.4, outX: 4.4, outY: 3.2 },
          { x: 0, y: -2.0, inX: -4.2, inY: 0, outX: 4.2, outY: 0 },
          { x: 11.4, y: -5.4, inX: -4.4, inY: 3.2, outX: 0.6, outY: 3.4 },
          { x: 0, y: 10.8, inX: 7.8, inY: 0, outX: -7.8, outY: 0 },
        ]
      : [
          { x: -10.4, y: -3.2, inX: -0.6, inY: 2.1, outX: 3.8, outY: 2.0 },
          { x: 0, y: -1.1, inX: -3.8, inY: 0, outX: 3.8, outY: 0 },
          { x: 10.4, y: -3.2, inX: -3.8, inY: 2.0, outX: 0.6, outY: 2.1 },
          { x: 0, y: 7.2, inX: 6.8, inY: 0, outX: -6.8, outY: 0 },
        ],
  });
  addRadialFill(cavity, 0, -1.6, 12.2, 11.2, [
    [0, '#6a2335'],
    [0.45, '#4b1625'],
    [0.82, '#330d19'],
    [1, '#200710'],
  ]);

  const mouthInterior = g('Mouth interior', 0, 0, 'Mouth rig');
  addClip(mouthInterior, cavity);

  // Subtle warm resting portrait smile upper teeth glint & soft tongue glow (Pin identity at rest + speech!)
  if (pin) {
    const restTeeth = r('Smile teeth rest', 0, -2.1, 14.8, 3.6, null, 1.8, 'Mouth interior');
    addLinearFill(restTeeth, 0, -1.8, 0, 1.8, [
      [0, '#fffefa'],
      [0.72, '#f9f1e8'],
      [1, '#e8d8cc'],
    ]);
    restTeeth.props.opacity = 0.88;
    const restTongue = e('Smile tongue rest', 0, 7.6, 13.8, 7.4, null, 'Mouth interior');
    addRadialFill(restTongue, 0, -1.4, 7.0, 3.8, [
      [0, '#ff9a9e'],
      [0.58, '#de5d6d'],
      [1, '#9e3246'],
    ]);
    restTongue.props.opacity = 0.78;
  }

  const teeth = r('Mouth teeth', 0, pin ? -1.8 : -1.6, 14.6, 3.8, null, 1.8, 'Mouth interior');
  addLinearFill(teeth, 0, -1.8, 0, 1.8, [
    [0, '#fffdf8'],
    [0.7, '#f8efe4'],
    [1, '#e6d5c8'],
  ]);
  teeth.props.opacity = 0;
  bind(teeth, 18, 'teeth');

  const tongue = e('Mouth tongue', 0, pin ? 6.4 : 4.0, 13.4, 6.2, null, 'Mouth interior');
  addRadialFill(tongue, 0, -1.2, 6.8, 3.4, [
    [0, '#ffb0be'],
    [0.45, '#ee7c92'],
    [0.85, '#c4506b'],
    [1, '#98354e'],
  ]);
  tongue.props.opacity = 0;
  bind(tongue, 18, 'tongue');

  // Plane 5: Complete Articulated Arm Chain — Shoulders, Upper Arms, Elbows, Forearms, Wrists & Plush Rounded Hands
  // Smooth continuous glossy coral Pixar limbs (zero harsh sausage-link joint rings!) with soft rounded hands & fingers.
  moving('Limbs', 1.45, 0.72, 0.58, true);

  const shoulderX = pin ? 34.4 : 34.8;
  const shoulderY = pin ? 4.8 : 3.4;
  for (const [side, sx, baseShoulderRot, baseElbowRot] of [
    ['L', -shoulderX, 16, -18],
    ['R', shoulderX, -16, 18],
  ] as const) {
    // Explicit Shoulder pivot -> Arm rotation pivot -> WeightShift compensation node
    g('Shoulder ' + side, sx, shoulderY, 'Limbs motion');
    const armRoot = g('Arm ' + side, 0, 0, 'Shoulder ' + side);
    armRoot.props.rotation = (baseShoulderRot * Math.PI) / 180;
    // Independent weight-shift shoulder compensation node (animated by 11.7s WeightShift layer)
    g('Arm idle ' + side, 0, 0, 'Arm ' + side);

    // Smooth continuous glossy coral upper arm (soft lit-to-base studio lighting, zero hard edge ring!)
    const upperArm = r('Upper arm ' + side, 0, 4.6, 8.6, 14.4, null, 4.3, 'Arm idle ' + side);
    addLinearFill(upperArm, -4.3, -1.5, 4.3, 1.5, [
      [0, warmTop],
      [0.26, litMid],
      [0.62, base],
      [1, shadowMid],
    ]);

    // Explicit articulated Elbow pivot -> Soft blended elbow cap + seamless Forearm capsule
    g('Elbow ' + side, 0, 9.2, 'Arm idle ' + side);
    const forearm = g('Forearm ' + side, 0, 0, 'Elbow ' + side);
    forearm.props.rotation = (baseElbowRot * Math.PI) / 180;
    const elbowBlend = e('Elbow blend ' + side, 0, 0.2, 8.4, 8.4, null, 'Forearm ' + side);
    addRadialFill(elbowBlend, -2.0, -1.5, 4.6, 4.6, [
      [0, litMid],
      [0.55, base],
      [1, shadowMid],
    ]);
    const forearmMesh = r('Forearm mesh ' + side, 0, 4.0, 8.0, 12.2, null, 4.0, 'Forearm ' + side);
    addLinearFill(forearmMesh, -4.0, -1.2, 4.0, 1.2, [
      [0, warmTop],
      [0.26, litMid],
      [0.62, base],
      [1, shadowMid],
    ]);

    // Explicit articulated Wrist pivot -> independent 9.1s HandLife idle node -> Plush Hand palm & compact rounded fingers
    g('Wrist ' + side, 0, 8.4, 'Forearm ' + side);
    g('Hand idle ' + side, 0, 0, 'Wrist ' + side);
    g('Hand ' + side, 0, 0, 'Hand idle ' + side);

    // Compact plump thumb pivot (inner side of hand)
    const thumbSign = side === 'L' ? 1 : -1;
    const thumbPivot = g('Thumb pivot ' + side, thumbSign * 3.4, 0.4, 'Hand ' + side);
    thumbPivot.props.rotation = (-thumbSign * 26 * Math.PI) / 180;
    const thumbMesh = r('Hand thumb ' + side, 0, 1.3, 3.0, 4.0, null, 1.5, 'Thumb pivot ' + side);
    addLinearFill(thumbMesh, -1.5, 0, 1.6, 0, [
      [0, litMid],
      [0.52, base],
      [1, shadowMid],
    ]);

    // 3 cute rounded fingers (portrait Pixar toy proportions, crisp at 80px!)
    const fingerSpecs = [
      { idx: 1, x: thumbSign * 2.1, y: 2.8, len: 3.5, rot: -thumbSign * 7 },
      { idx: 2, x: 0, y: 3.2, len: 3.9, rot: 0 },
      { idx: 3, x: -thumbSign * 2.1, y: 2.7, len: 3.4, rot: thumbSign * 7 },
    ];
    for (const f of fingerSpecs) {
      const fPivot = g(`Finger ${f.idx} ${side}`, f.x, f.y, 'Hand ' + side);
      fPivot.props.rotation = (f.rot * Math.PI) / 180;
      const fMesh = r(`Finger ${f.idx} mesh ${side}`, 0, f.len * 0.4, 2.65, f.len, null, 1.33, `Finger ${f.idx} ${side}`);
      addLinearFill(fMesh, -1.35, 0, 1.35, 0, [
        [0, litMid],
        [0.48, base],
        [1, shadowMid],
      ]);
    }

    // Plush cushioned palm seamlessly blending wrist, thumb, and compact finger bases
    const handMesh = e('Hand mesh ' + side, 0, 1.2, 8.8, 8.2, null, 'Hand ' + side);
    addRadialFill(handMesh, -2.0, -1.8, 5.8, 5.4, [
      [0, warmTop],
      [0.24, litMid],
      [0.56, base],
      [0.9, shadowMid],
      [1, edge],
    ]);
  }

  // Plane 6: Dimensional Hinged Clamshell Miniature Laptop Prop
  // Smoothly unfolds open from the base hinge (`Laptop hinge` scaleY: 0.08 -> 1.0) during typing/thinking
  // and folds smoothly shut when finished, keeping Pin/Geo's face & mouth 100% unobstructed even at 64px.
  moving('Prop', 2.4, 1.15, 0.55, true);
  const laptopRig = g('Laptop rig', 0, 31.5, 'Prop motion');
  laptopRig.props.opacity = 0;

  // Soft accessory drop shadow beneath the miniature laptop base deck
  const laptopShadow = e('Laptop shadow', 0, 12.2, 50, 7.6, null, 'Laptop rig');
  addRadialFill(laptopShadow, 0, 0, 25, 3.8, [
    [0, '#040a127a'],
    [0.52, '#060e1836'],
    [1, '#060e1800'],
  ]);

  // Miniature laptop base deck (dimensional metallic chassis + subtle keyboard deck rim)
  const laptopBase = r('Laptop base', 0, 10.2, 47, 4.0, null, 2.0, 'Laptop rig');
  addLinearFill(laptopBase, -23.5, 0, 23.5, 0, [
    [0, '#273547'],
    [0.22, '#5f748d'],
    [0.52, '#91a7c0'],
    [0.82, '#475b72'],
    [1, '#1b2634'],
  ]);
  const laptopLip = r('Laptop base lip', 0, 11.4, 34, 1.2, null, 0.6, 'Laptop rig');
  addLinearFill(laptopLip, -17, 0, 17, 0, [
    [0, '#ffffff00'],
    [0.5, '#d8ecff44'],
    [1, '#ffffff00'],
  ]);

  // Articulated clamshell hinge along rear of base deck (scaleY animates 0.08 closed <-> 1.0 open!)
  const laptopHinge = g('Laptop hinge', 0, 8.8, 'Laptop rig');
  laptopHinge.props.scaleY = 0.08;

  // Soft luminous screen glow radiating upward from the open lid
  const laptopAura = e('Laptop aura', 0, -20.0, 50, 22, null, 'Laptop hinge');
  addRadialFill(laptopAura, 0, 4, 25, 11, [
    [0, '#9eeeff72'],
    [0.5, '#6eb8ff2e'],
    [1, '#6eb8ff00'],
  ]);

  // Sculpted anodized aluminum miniature laptop lid (anchored above hinge at y = -11.2)
  const laptopLid = r('Laptop lid', 0, -11.2, 42, 23.0, null, 4.4, 'Laptop hinge');
  addLinearFill(laptopLid, -19, -23, 19, 2, [
    [0, '#647994'],
    [0.3, '#384a61'],
    [0.72, '#1f2c3c'],
    [1, '#131b26'],
  ]);
  const laptopLidClip = g('Laptop lid clip', 0, 0, 'Laptop hinge');
  addClip(laptopLidClip, laptopLid);

  // Subtle brushed-aluminum diagonal studio specular sweep across laptop lid
  const laptopSheen = e('Laptop sheen', -10, -17, 32, 14, null, 'Laptop lid clip');
  laptopSheen.props.rotation = (-18 * Math.PI) / 180;
  addRadialFill(laptopSheen, -4, -3, 16, 8, [
    [0, '#ffffff42'],
    [0.55, '#cce8ff18'],
    [1, '#cce8ff00'],
  ]);

  // Crisp luminous active screen-rim highlight along the top bevel of the laptop lid
  const laptopScreenRim = r('Laptop screen rim', 0, -22.2, 36, 1.5, null, 0.75, 'Laptop lid clip');
  addLinearFill(laptopScreenRim, -18, 0, 18, 0, [
    [0, '#9beaff00'],
    [0.2, '#9beaff88'],
    [0.5, '#eefcffcc'],
    [0.8, '#9beaff88'],
    [1, '#9beaff00'],
  ]);

  // Crisp glowing Questie beacon emblem centered on the miniature laptop lid
  const laptopLogoHalo = e('Laptop logo halo', 0, -11.2, 12.2, 12.2, null, 'Laptop hinge');
  addRadialFill(laptopLogoHalo, 0, 0, 6.2, 6.2, [
    [0, hexWithAlpha(cfg.beaconColor, '72')],
    [0.55, hexWithAlpha(cfg.beaconColor, '20')],
    [1, hexWithAlpha(cfg.beaconColor, '00')],
  ]);
  e('Laptop logo', 0, -11.2, 5.4, 5.4, cfg.beaconColor, 'Laptop hinge');
  e('Laptop logo glint', -0.9, -12.1, 1.8, 1.6, '#f2fffd', 'Laptop hinge').props.opacity = 0.92;

  // =========================================================================
  // NATIVE RIVE ANIMATIONS & 9-LAYER MULTI-PERIOD AUTONOMOUS STATE MACHINE
  // =========================================================================
  const key = (
    animation: string,
    object: string,
    property: string,
    keys: Parameters<typeof addKeyframes>[1]['keys'],
  ) => addKeyframes(doc, { animation, object, property, keys });
  const pose = (animation: string, object: string, property: string, value: number | string) =>
    key(animation, object, property, [{ frame: 0, value }]);

  // LAYER 1: Continuous Native Subtle Breathing (`Breathe`, 7.3s prime-offset serene loop)
  // Includes organic vertical rib/head lift + subtle squash/stretch + floor shadow counter-breath.
  addAnimation(doc, { name: 'Breathe', duration: 7.3, loop: 'loop' });
  const breathAmp = 1.0 * breathScale;
  key('Breathe', 'Body idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.1, value: -0.95 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Body idle', 'scaleX', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 3.1, value: 1 + 0.011 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 1 },
  ]);
  key('Breathe', 'Body idle', 'scaleY', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 3.1, value: 1 - 0.008 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 1 },
  ]);
  key('Breathe', 'Head idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.2, value: -1.45 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Head idle', 'scaleX', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 3.2, value: 1 + 0.009 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 1 },
  ]);
  key('Breathe', 'Head idle', 'scaleY', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 3.2, value: 1 - 0.007 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 1 },
  ]);
  key('Breathe', 'MidFace idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.25, value: -1.55 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Face idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.3, value: -1.65 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Limbs idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.15, value: -1.15 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Prop idle', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.15, value: -0.9 * breathAmp, ease: 'easeInOut' },
    { time: 7.3, value: 0 },
  ]);
  key('Breathe', 'Ground shadow', 'scaleX', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 3.2, value: 0.96, ease: 'easeInOut' },
    { time: 7.3, value: 1 },
  ]);

  // LAYER 2: Independent Body Weight Shifts & Head Counter-Balance (`BodySway`, 11.7s loop)
  // Incommensurate period (11.7s vs 7.3s breath) prevents mechanical loop synchronization!
  addAnimation(doc, { name: 'BodySway', duration: 11.7, loop: 'loop' });
  key('BodySway', 'Body weight', 'x', [
    { time: 0, value: -0.65, ease: 'easeInOut' },
    { time: 5.4, value: 0.72, ease: 'easeInOut' },
    { time: 11.7, value: -0.65 },
  ]);
  key('BodySway', 'Body weight', 'rotationDegrees', [
    { time: 0, value: -0.55, ease: 'easeInOut' },
    { time: 5.5, value: 0.62, ease: 'easeInOut' },
    { time: 11.7, value: -0.55 },
  ]);
  key('BodySway', 'Head weight', 'x', [
    { time: 0, value: -0.85, ease: 'easeInOut' },
    { time: 5.6, value: 0.92, ease: 'easeInOut' },
    { time: 11.7, value: -0.85 },
  ]);
  key('BodySway', 'Head weight', 'rotationDegrees', [
    { time: 0, value: -0.95, ease: 'easeInOut' },
    { time: 5.8, value: 1.05, ease: 'easeInOut' },
    { time: 11.7, value: -0.95 },
  ]);
  key('BodySway', 'MidFace weight', 'x', [
    { time: 0, value: -1.0, ease: 'easeInOut' },
    { time: 5.65, value: 1.08, ease: 'easeInOut' },
    { time: 11.7, value: -1.0 },
  ]);
  key('BodySway', 'Face weight', 'x', [
    { time: 0, value: -1.15, ease: 'easeInOut' },
    { time: 5.7, value: 1.24, ease: 'easeInOut' },
    { time: 11.7, value: -1.15 },
  ]);
  key('BodySway', 'Face weight', 'rotationDegrees', [
    { time: 0, value: -1.05, ease: 'easeInOut' },
    { time: 5.85, value: 1.15, ease: 'easeInOut' },
    { time: 11.7, value: -1.05 },
  ]);
  key('BodySway', 'Limbs weight', 'x', [
    { time: 0, value: -0.78, ease: 'easeInOut' },
    { time: 5.5, value: 0.84, ease: 'easeInOut' },
    { time: 11.7, value: -0.78 },
  ]);
  key('BodySway', 'Prop weight', 'x', [
    { time: 0, value: -0.5, ease: 'easeInOut' },
    { time: 5.5, value: 0.55, ease: 'easeInOut' },
    { time: 11.7, value: -0.5 },
  ]);
  key('BodySway', 'Arm idle L', 'rotationDegrees', [
    { time: 0, value: -1.6, ease: 'easeInOut' },
    { time: 4.1, value: 2.4, ease: 'easeInOut' },
    { time: 8.2, value: -0.8, ease: 'easeInOut' },
    { time: 11.7, value: -1.6 },
  ]);
  key('BodySway', 'Arm idle R', 'rotationDegrees', [
    { time: 0, value: 1.8, ease: 'easeInOut' },
    { time: 4.5, value: -2.3, ease: 'easeInOut' },
    { time: 8.6, value: 0.9, ease: 'easeInOut' },
    { time: 11.7, value: 1.8 },
  ]);

  // LAYER 3: Continuous Native Autonomous Blinking (`Blink`, 10.3s irregular single + double blink)
  addAnimation(doc, { name: 'Blink', duration: 10.3, loop: 'loop' });
  for (const side of ['L', 'R']) {
    key('Blink', 'Upper lid auto ' + side, 'y', [
      { time: 0, value: 0 },
      { time: 3.45, value: 0, ease: 'easeInOut' },
      { time: 3.53, value: 14.2 },
      { time: 3.56, value: 14.2, ease: 'easeInOut' },
      { time: 3.7, value: 0 },
      { time: 7.9, value: 0, ease: 'easeInOut' },
      { time: 7.98, value: 14.2 },
      { time: 8.0, value: 14.2, ease: 'easeInOut' },
      { time: 8.12, value: 0 },
      { time: 8.28, value: 0, ease: 'easeInOut' },
      { time: 8.36, value: 14.2 },
      { time: 8.39, value: 14.2, ease: 'easeInOut' },
      { time: 8.53, value: 0 },
      { time: 10.3, value: 0 },
    ]);
    key('Blink', 'Lower lid auto ' + side, 'y', [
      { time: 0, value: 0 },
      { time: 3.45, value: 0, ease: 'easeInOut' },
      { time: 3.53, value: -8.8 },
      { time: 3.56, value: -8.8, ease: 'easeInOut' },
      { time: 3.7, value: 0 },
      { time: 7.9, value: 0, ease: 'easeInOut' },
      { time: 7.98, value: -8.8 },
      { time: 8.0, value: -8.8, ease: 'easeInOut' },
      { time: 8.12, value: 0 },
      { time: 8.28, value: 0, ease: 'easeInOut' },
      { time: 8.36, value: -8.8 },
      { time: 8.39, value: -8.8, ease: 'easeInOut' },
      { time: 8.53, value: 0 },
      { time: 10.3, value: 0 },
    ]);
  }

  // LAYER 4: Subtle Native Autonomous Eye Glances & Brow Microexpressions (`GazeDrift`, 13.9s loop)
  addAnimation(doc, { name: 'GazeDrift', duration: 13.9, loop: 'loop' });
  for (const side of ['L', 'R']) {
    key('GazeDrift', 'Native gaze ' + side, 'x', [
      { time: 0, value: 0, ease: 'easeInOut' },
      { time: 2.9, value: 0.76 * eyeTrack, ease: 'easeInOut' },
      { time: 5.4, value: 0.62 * eyeTrack, ease: 'easeInOut' },
      { time: 7.1, value: -0.82 * eyeTrack, ease: 'easeInOut' },
      { time: 10.2, value: -0.48 * eyeTrack, ease: 'easeInOut' },
      { time: 12.1, value: 0.16 * eyeTrack, ease: 'easeInOut' },
      { time: 13.9, value: 0 },
    ]);
    key('GazeDrift', 'Native gaze ' + side, 'y', [
      { time: 0, value: 0, ease: 'easeInOut' },
      { time: 3.4, value: -0.34 * eyeTrack, ease: 'easeInOut' },
      { time: 7.4, value: 0.28 * eyeTrack, ease: 'easeInOut' },
      { time: 10.8, value: -0.24 * eyeTrack, ease: 'easeInOut' },
      { time: 13.9, value: 0 },
    ]);
  }
  // Independent left/right eyebrow microexpressions (quiet living curiosity & empathy)
  key('GazeDrift', 'Brow micro L', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.6, value: -0.65, ease: 'easeInOut' },
    { time: 6.4, value: 0.18, ease: 'easeInOut' },
    { time: 10.4, value: -0.42, ease: 'easeInOut' },
    { time: 13.9, value: 0 },
  ]);
  key('GazeDrift', 'Brow micro R', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.9, value: -0.35, ease: 'easeInOut' },
    { time: 7.2, value: -0.78, ease: 'easeInOut' },
    { time: 10.9, value: 0.15, ease: 'easeInOut' },
    { time: 13.9, value: 0 },
  ]);
  key('GazeDrift', 'Brow micro L', 'rotationDegrees', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 3.6, value: -1.6, ease: 'easeInOut' },
    { time: 8.5, value: 0.9, ease: 'easeInOut' },
    { time: 13.9, value: 0 },
  ]);
  key('GazeDrift', 'Brow micro R', 'rotationDegrees', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 7.2, value: 1.8, ease: 'easeInOut' },
    { time: 11.1, value: -0.8, ease: 'easeInOut' },
    { time: 13.9, value: 0 },
  ]);

  // LAYER 5: Ambient Hand & Wrist Micro-Motion (`HandIdle`, 9.1s loop)
  // Keeps hands & wrists subtly alive even during quiet resting periods.
  addAnimation(doc, { name: 'HandIdle', duration: 9.1, loop: 'loop' });
  key('HandIdle', 'Hand idle L', 'rotationDegrees', [
    { time: 0, value: -2.0, ease: 'easeInOut' },
    { time: 3.8, value: 2.8, ease: 'easeInOut' },
    { time: 6.7, value: -0.6, ease: 'easeInOut' },
    { time: 9.1, value: -2.0 },
  ]);
  key('HandIdle', 'Hand idle R', 'rotationDegrees', [
    { time: 0, value: 1.6, ease: 'easeInOut' },
    { time: 4.4, value: -2.9, ease: 'easeInOut' },
    { time: 7.2, value: 0.8, ease: 'easeInOut' },
    { time: 9.1, value: 1.6 },
  ]);

  // LAYER 6: Independent Status Ball Ambient Pulse (`StatusGlow`, 5.9s loop)
  addAnimation(doc, { name: 'StatusGlow', duration: 5.9, loop: 'loop' });
  key('StatusGlow', 'Halo aura', 'scaleX', [
    { time: 0, value: 0.94, ease: 'easeInOut' },
    { time: 2.7, value: 1.09, ease: 'easeInOut' },
    { time: 5.9, value: 0.94 },
  ]);
  key('StatusGlow', 'Halo aura', 'scaleY', [
    { time: 0, value: 0.94, ease: 'easeInOut' },
    { time: 2.7, value: 1.09, ease: 'easeInOut' },
    { time: 5.9, value: 0.94 },
  ]);
  key('StatusGlow', 'Beacon caustic', 'opacity', [
    { time: 0, value: 0.72, ease: 'easeInOut' },
    { time: 2.7, value: 1.0, ease: 'easeInOut' },
    { time: 5.9, value: 0.72 },
  ]);
  key('StatusGlow', 'Beacon spill', 'opacity', [
    { time: 0, value: 0.66, ease: 'easeInOut' },
    { time: 2.7, value: 1.0, ease: 'easeInOut' },
    { time: 5.9, value: 0.66 },
  ]);

  const sm = addStateMachine(doc, { name: 'Guide' });
  sm.children!.find((c) => c.type === 'StateMachineLayer')!.props.name = 'Idle';
  // Backward-compatible native State Machine Inputs for explicit accessory, headphones & arm gesture overrides
  // (leaves GuideVM strictly at its exact 13-property contract!)
  addInput(doc, { stateMachine: 'Guide', type: 'number', name: 'laptopMode', value: 0 });
  addInput(doc, { stateMachine: 'Guide', type: 'number', name: 'armGesture', value: 0 });
  addInput(doc, { stateMachine: 'Guide', type: 'number', name: 'headphonesMode', value: 0 });

  const layer = (layerName: string) => {
    sm.children!.push(newLayer(layerName));
  };
  const start = (layerName: string, animation: string) => {
    addState(doc, { stateMachine: 'Guide', layer: layerName, animation });
    addTransition(doc, { stateMachine: 'Guide', layer: layerName, from: 'entry', to: animation });
  };
  start('Idle', 'Breathe');

  layer('WeightShift');
  start('WeightShift', 'BodySway');

  layer('AutoBlink');
  start('AutoBlink', 'Blink');

  layer('AutoGaze');
  start('AutoGaze', 'GazeDrift');

  layer('HandLife');
  start('HandLife', 'HandIdle');

  layer('BeaconGlow');
  start('BeaconGlow', 'StatusGlow');

  // Each property switches a dedicated layer, so speech never interrupts idle, blinking, or gaze.
  function poses(layerName: string, property: string, names: string[], durationMs: number) {
    layer(layerName);
    for (const animation of names) addState(doc, { stateMachine: 'Guide', layer: layerName, animation });
    addTransition(doc, { stateMachine: 'Guide', layer: layerName, from: 'entry', to: names[0]! });
    for (const from of names) {
      for (const [i, to] of names.entries()) {
        if (from !== to) {
          addTransition(doc, {
            stateMachine: 'Guide',
            layer: layerName,
            from,
            to,
            durationMs,
            conditions: [{ property, value: i }],
          });
        }
      }
    }
  }

  // Named editorial reference viseme timelines remain available alongside live GuideVM morphs
  const mouths = GUIDE_MOUTHS.map((m) => 'Viseme ' + m[0]);
  for (const [i, animation] of mouths.entries()) {
    addAnimation(doc, { name: animation, duration: 0.14, loop: 'oneShot' });
    const [, rx, ry, t, tg] = GUIDE_MOUTHS[i]!;
    pose(animation, 'Mouth rig', 'scaleX', rx / 10);
    pose(animation, 'Mouth rig', 'scaleY', ry / 6);
    pose(animation, 'Mouth teeth', 'opacity', t);
    pose(animation, 'Mouth tongue', 'opacity', tg);
  }

  // =========================================================================
  // LAYER 4: 13 LOOPING NATIVE REACTIVE BEHAVIOR PERFORMANCES (`Emotion`)
  // Full arm/forearm/hand articulation, laptop typing/pondering, brow nuance,
  // coordinated head/torso choreography, and luminous status-ball color blends.
  // =========================================================================
  interface ReactionPoseSpec {
    duration: number;
    headTilt: number;
    faceTilt: number;
    bodyTilt: number;
    browLY: number;
    browRY: number;
    browLRot: number;
    browRRot: number;
    armL: number;
    forearmL: number;
    handL: number;
    armR: number;
    forearmR: number;
    handR: number;
    showLaptop?: boolean;
    wearHeadphones?: boolean;
    mode?: 'rest' | 'typing' | 'listen' | 'favorite' | 'pricedrop' | 'newhome' | 'travel' | 'wave' | 'achieve' | 'guide' | 'lookout' | 'ponder' | 'speak';
  }

  const reactionSpecs: ReactionPoseSpec[] = [
    // 0 ready (IDLE-PARKED) — serene, quietly alive resting companion with relaxed curved arms
    { duration: 4.8, headTilt: 0, faceTilt: 0, bodyTilt: 0, browLY: -26.2, browRY: -26.2, browLRot: 0, browRRot: 0, armL: 14, forearmL: -18, handL: -4, armR: -14, forearmR: 18, handR: 4, mode: 'rest' },
    // 1 thinking (WORK-THINK) — over-ear headphones on + hands tucked onto glowing miniature laptop keyboard!
    { duration: 3.6, headTilt: -2.4, faceTilt: -2.8, bodyTilt: -0.7, browLY: -25.4, browRY: -27.2, browLRot: 4.0, browRRot: -2.8, armL: -26, forearmL: -28, handL: -8, armR: 26, forearmR: 28, handR: 8, showLaptop: true, wearHeadphones: true, mode: 'typing' },
    // 2 listening (TYPE-LISTEN) — warm attentive lean-in with gentle occasional native micro-nod
    { duration: 4.4, headTilt: 2.2, faceTilt: 2.6, bodyTilt: 0.7, browLY: -27.2, browRY: -27.2, browLRot: -2.5, browRRot: 2.5, armL: 8, forearmL: -26, handL: -8, armR: -8, forearmR: 26, handR: 8, mode: 'listen' },
    // 3 favorite (FAVORITE) — affectionate tilt, hands warmly folded inward over chest
    { duration: 4.0, headTilt: 3.0, faceTilt: 3.4, bodyTilt: 1.1, browLY: -27.8, browRY: -27.8, browLRot: -4.5, browRRot: 4.5, armL: -34, forearmL: -52, handL: -12, armR: 34, forearmR: 52, handR: 12, mode: 'favorite' },
    // 4 pricedrop (PRICE DROP) — crisp alert intrigue, raised brows & poised attentive hands
    { duration: 3.8, headTilt: -2.4, faceTilt: -2.8, bodyTilt: -0.7, browLY: -28.4, browRY: -28.4, browLRot: -3.5, browRRot: 3.5, armL: 24, forearmL: -44, handL: -12, armR: -24, forearmR: 44, handR: 12, mode: 'pricedrop' },
    // 5 newhome (NEW HOME) — hopeful discovery with open welcoming right-hand presenting gesture
    { duration: 4.2, headTilt: 2.8, faceTilt: 3.2, bodyTilt: 1.0, browLY: -27.9, browRY: -27.5, browLRot: -4.5, browRRot: 2.5, armL: 16, forearmL: -24, handL: -6, armR: -62, forearmR: -32, handR: -10, mode: 'newhome' },
    // 6 traveling (NAV-EXPLORE) — exploratory forward poise with calm scouting arm rhythm
    { duration: 4.0, headTilt: 3.1, faceTilt: 3.6, bodyTilt: 1.4, browLY: -27.0, browRY: -26.7, browLRot: -2, browRRot: 2, armL: 22, forearmL: -20, handL: -4, armR: -10, forearmR: 22, handR: 6, mode: 'travel' },
    // 7 arrived (ARRIVED) — calm grounded arrival with graceful high right-hand greeting wave
    { duration: 3.6, headTilt: 1.6, faceTilt: 1.9, bodyTilt: 0.5, browLY: -27.5, browRY: -27.5, browLRot: -3.5, browRRot: 3.5, armL: 14, forearmL: -18, handL: -4, armR: -110, forearmR: -40, handR: -8, mode: 'wave' },
    // 8 achievement (ACHIEVEMENT) — dignified pride, both articulated arms raised joyfully
    { duration: 4.0, headTilt: 3.0, faceTilt: 3.5, bodyTilt: 1.2, browLY: -28.2, browRY: -28.2, browLRot: -5.5, browRRot: 5.5, armL: 118, forearmL: 34, handL: 8, armR: -118, forearmR: -34, handR: -8, mode: 'achieve' },
    // 9 guide (GUIDE) — gentle presenting right-hand gesture
    { duration: 4.2, headTilt: -2.0, faceTilt: -2.3, bodyTilt: -0.6, browLY: -27.2, browRY: -27.2, browLRot: -2.5, browRRot: 2.5, armL: 14, forearmL: -18, handL: -4, armR: -76, forearmR: -28, handR: -10, mode: 'guide' },
    // 10 lookout (IDLE-LOOKOUT) — calm horizon scanning tilt with subtle poised arms
    { duration: 5.2, headTilt: -2.5, faceTilt: -2.9, bodyTilt: -0.8, browLY: -27.4, browRY: -26.9, browLRot: -3.5, browRRot: 2, armL: 18, forearmL: -22, handL: -6, armR: -20, forearmR: 24, handR: 8, mode: 'lookout' },
    // 11 ponder (TYPE-PONDER) — working headphones + glowing laptop open + right hand genuinely poised at chin!
    { duration: 4.6, headTilt: -3.8, faceTilt: -4.2, bodyTilt: -1.1, browLY: -25.4, browRY: -27.8, browLRot: 4.8, browRRot: -4.2, armL: -26, forearmL: -26, handL: -8, armR: 48, forearmR: 78, handR: 22, showLaptop: true, wearHeadphones: true, mode: 'ponder' },
    // 12 speaking (SPEAK-ATTEND) — engaged conversational poise with subtle articulated hand cadence
    { duration: 4.0, headTilt: 1.4, faceTilt: 1.7, bodyTilt: 0.5, browLY: -27.2, browRY: -27.2, browLRot: -2.5, browRRot: 2.5, armL: 6, forearmL: -32, handL: -10, armR: -24, forearmR: -18, handR: -8, mode: 'speak' },
  ];

  const reactions = GUIDE_REACTIONS.map((rx) => 'Reaction ' + rx[0]);
  for (const [i, animation] of reactions.entries()) {
    const spec = reactionSpecs[i] ?? reactionSpecs[0]!;
    const dur = spec.duration;
    addAnimation(doc, { name: animation, duration: dur, loop: 'loop' });

    const color = i === 0 ? cfg.beaconColor : GUIDE_REACTIONS[i]![1];
    pose(animation, 'Beacon', 'fill', color);
    pose(animation, 'Halo', 'fill', hexWithAlpha(color, '36'));
    pose(animation, 'HP led L', 'fill', color);
    pose(animation, 'HP led R', 'fill', color);

    // Hinged clamshell laptop prop visibility, lid unfold/fold (`Laptop hinge` scaleY), torso AO & screen glow
    if (spec.showLaptop) {
      pose(animation, 'Laptop rig', 'opacity', 1);
      pose(animation, 'Laptop hinge', 'scaleY', 1);
      pose(animation, 'Laptop torso AO', 'opacity', 0.88);
      key(animation, 'Laptop rig', 'y', [
        { time: 0, value: 30.8, ease: 'easeInOut' },
        { time: dur * 0.5, value: 29.9, ease: 'easeInOut' },
        { time: dur, value: 30.8 },
      ]);
      key(animation, 'Laptop face glow', 'opacity', [
        { time: 0, value: 0.74, ease: 'easeInOut' },
        { time: dur * 0.45, value: 0.94, ease: 'easeInOut' },
        { time: dur, value: 0.74 },
      ]);
    } else {
      pose(animation, 'Laptop rig', 'opacity', 0);
      pose(animation, 'Laptop hinge', 'scaleY', 0.08);
      pose(animation, 'Laptop rig', 'y', 39.5);
      pose(animation, 'Laptop torso AO', 'opacity', 0);
      pose(animation, 'Laptop face glow', 'opacity', 0);
    }

    // Native Over-Ear Working Headphones smooth glide-on / glide-off transition between resting & working
    if (spec.wearHeadphones) {
      pose(animation, 'Headphones rig', 'opacity', 1);
      pose(animation, 'Headphones rig', 'scaleX', 1);
      pose(animation, 'Headphones rig', 'scaleY', 1);
      key(animation, 'Headphones rig', 'y', [
        { time: 0, value: 0, ease: 'easeInOut' },
        { time: dur * 0.5, value: 0.55, ease: 'easeInOut' },
        { time: dur, value: 0 },
      ]);
      key(animation, 'HP led L', 'opacity', [
        { time: 0, value: 0.76, ease: 'easeInOut' },
        { time: dur * 0.5, value: 1.0, ease: 'easeInOut' },
        { time: dur, value: 0.76 },
      ]);
      key(animation, 'HP led R', 'opacity', [
        { time: 0, value: 0.76, ease: 'easeInOut' },
        { time: dur * 0.5, value: 1.0, ease: 'easeInOut' },
        { time: dur, value: 0.76 },
      ]);
    } else {
      pose(animation, 'Headphones rig', 'opacity', 0);
      pose(animation, 'Headphones rig', 'y', -14);
      pose(animation, 'Headphones rig', 'scaleX', 0.92);
      pose(animation, 'Headphones rig', 'scaleY', 0.92);
    }

    // Base posture + subtle organic breathing choreography per reaction
    const sway = spec.mode === 'lookout' ? 2.4 : spec.mode === 'travel' ? 1.8 : 0.7;
    key(animation, 'Body motion', 'rotationDegrees', [
      { time: 0, value: spec.bodyTilt, ease: 'easeInOut' },
      { time: dur * 0.5, value: spec.bodyTilt + sway * 0.3, ease: 'easeInOut' },
      { time: dur, value: spec.bodyTilt },
    ]);
    key(animation, 'Head motion', 'rotationDegrees', [
      { time: 0, value: spec.headTilt, ease: 'easeInOut' },
      { time: dur * 0.5, value: spec.headTilt + sway, ease: 'easeInOut' },
      { time: dur, value: spec.headTilt },
    ]);
    key(animation, 'MidFace motion', 'rotationDegrees', [
      { time: 0, value: spec.headTilt * 1.04, ease: 'easeInOut' },
      { time: dur * 0.5, value: (spec.headTilt + sway) * 1.04, ease: 'easeInOut' },
      { time: dur, value: spec.headTilt * 1.04 },
    ]);
    key(animation, 'Face motion', 'rotationDegrees', [
      { time: 0, value: spec.faceTilt, ease: 'easeInOut' },
      { time: dur * 0.5, value: spec.faceTilt + sway * 1.1, ease: 'easeInOut' },
      { time: dur, value: spec.faceTilt },
    ]);
    key(animation, 'Limbs motion', 'rotationDegrees', [
      { time: 0, value: spec.bodyTilt * 1.1, ease: 'easeInOut' },
      { time: dur * 0.5, value: (spec.bodyTilt + sway * 0.35) * 1.1, ease: 'easeInOut' },
      { time: dur, value: spec.bodyTilt * 1.1 },
    ]);
    pose(animation, 'Prop motion', 'rotationDegrees', spec.bodyTilt * 0.6);

    // Subtle listening affirmative micro-nod (TYPE-LISTEN) & gentle focused headphone groove (WORK-THINK)
    if (spec.mode === 'listen') {
      key(animation, 'Head motion', 'y', [
        { time: 0, value: 0 },
        { time: 1.8, value: 0, ease: 'easeInOut' },
        { time: 2.15, value: 1.5, ease: 'easeInOut' },
        { time: 2.6, value: 0 },
        { time: dur, value: 0 },
      ]);
      key(animation, 'Face motion', 'y', [
        { time: 0, value: 0 },
        { time: 1.8, value: 0, ease: 'easeInOut' },
        { time: 2.15, value: 1.9, ease: 'easeInOut' },
        { time: 2.6, value: 0 },
        { time: dur, value: 0 },
      ]);
    } else if (spec.mode === 'typing') {
      key(animation, 'Head motion', 'y', [
        { time: 0, value: 0, ease: 'easeInOut' },
        { time: 0.9, value: 0.95, ease: 'easeInOut' },
        { time: 1.8, value: 0.1, ease: 'easeInOut' },
        { time: 2.7, value: 1.05, ease: 'easeInOut' },
        { time: dur, value: 0 },
      ]);
      key(animation, 'Face motion', 'y', [
        { time: 0, value: 0, ease: 'easeInOut' },
        { time: 0.95, value: 1.15, ease: 'easeInOut' },
        { time: 1.85, value: 0.15, ease: 'easeInOut' },
        { time: 2.75, value: 1.25, ease: 'easeInOut' },
        { time: dur, value: 0 },
      ]);
    } else {
      pose(animation, 'Head motion', 'y', 0);
      pose(animation, 'Face motion', 'y', 0);
    }

    // Expressive eyebrows
    pose(animation, 'Brow rig L', 'y', spec.browLY);
    pose(animation, 'Brow rig R', 'y', spec.browRY);
    pose(animation, 'Brow rig L', 'rotationDegrees', spec.browLRot);
    pose(animation, 'Brow rig R', 'rotationDegrees', spec.browRRot);

    // Helper to pose fingers cleanly per hand
    const setHandFingers = (side: 'L' | 'R', spread: number, scales: [number, number, number], thumbRot: number) => {
      const s = side === 'L' ? 1 : -1;
      pose(animation, `Thumb pivot ${side}`, 'rotationDegrees', thumbRot);
      pose(animation, `Finger 1 ${side}`, 'rotationDegrees', -s * spread);
      pose(animation, `Finger 2 ${side}`, 'rotationDegrees', 0);
      pose(animation, `Finger 3 ${side}`, 'rotationDegrees', s * spread);
      pose(animation, `Finger 1 ${side}`, 'scaleY', scales[0]);
      pose(animation, `Finger 2 ${side}`, 'scaleY', scales[1]);
      pose(animation, `Finger 3 ${side}`, 'scaleY', scales[2]);
    };

    // Articulated shoulder / forearm / wrist / finger choreography per behavior state!
    if (spec.mode === 'typing') {
      // Alternating native wrist taps with small forearm follow-through (Phase 5.3 + 5.4 unified).
      // The resting keyboard-contact pose remains the center of each excursion.
      pose(animation, 'Arm L', 'rotationDegrees', spec.armL);
      pose(animation, 'Arm R', 'rotationDegrees', spec.armR);
      for (const side of ['L', 'R'] as const) {
        const left = side === 'L';
        const forearm = left ? spec.forearmL : spec.forearmR;
        const wrist = left ? spec.handL : spec.handR;
        const sign = left ? -1 : 1;
        const taps = left ? [0.32, 1.44, 2.56] : [0.86, 1.98, 3.10];
        const tapKeys = (base: number, amount: number) => [
          { time: 0, value: base },
          ...taps.flatMap((t) => [
            { time: Number((t - 0.12).toFixed(2)), value: base, ease: 'easeInOut' as const },
            { time: t, value: base + sign * amount, ease: 'easeInOut' as const },
            { time: Number((t + 0.16).toFixed(2)), value: base, ease: 'easeInOut' as const },
          ]),
          { time: dur, value: base },
        ];
        key(animation, 'Forearm ' + side, 'rotationDegrees', tapKeys(forearm, 2.6));
        key(animation, 'Hand ' + side, 'rotationDegrees', tapKeys(wrist, 5.2));
      }

      // Independent staggered 6-finger keystroke taps + spacebar thumb taps!
      const tapSchedule: Array<[string, number, number]> = [
        ['Finger 1 L', 0.12, -10],
        ['Finger 2 L', 0.42, 0],
        ['Finger 3 L', 0.72, 10],
        ['Finger 1 R', 0.28, 10],
        ['Finger 2 R', 0.58, 0],
        ['Finger 3 R', 0.88, -10],
      ];
      for (const [fingerName, phase, baseRot] of tapSchedule) {
        const t1 = Number((phase * 0.9).toFixed(2));
        const t2 = Number((t1 + 0.16).toFixed(2));
        const t3 = Number((t1 + 0.34).toFixed(2));
        const t4 = Number((t1 + 1.15).toFixed(2));
        const t5 = Number((t4 + 0.16).toFixed(2));
        const t6 = Number((t4 + 0.34).toFixed(2));
        const t7 = Number((t1 + 2.25).toFixed(2));
        const t8 = Number((t7 + 0.16).toFixed(2));
        const t9 = Number((t7 + 0.34).toFixed(2));
        pose(animation, fingerName, 'rotationDegrees', baseRot);
        key(animation, fingerName, 'scaleY', [
          { time: 0, value: 0.96 },
          { time: t1, value: 0.96, ease: 'easeInOut' },
          { time: t2, value: 0.64, ease: 'easeInOut' },
          { time: t3, value: 1.02 },
          { time: t4, value: 0.96, ease: 'easeInOut' },
          { time: t5, value: 0.66, ease: 'easeInOut' },
          { time: t6, value: 1.0 },
          { time: t7, value: 0.96, ease: 'easeInOut' },
          { time: t8, value: 0.65, ease: 'easeInOut' },
          { time: t9, value: 0.98 },
          { time: dur, value: 0.96 },
        ]);
      }
      key(animation, 'Thumb pivot L', 'rotationDegrees', [
        { time: 0, value: -24, ease: 'easeInOut' },
        { time: 1.1, value: -14, ease: 'easeInOut' },
        { time: 1.4, value: -26, ease: 'easeInOut' },
        { time: dur, value: -24 },
      ]);
      key(animation, 'Thumb pivot R', 'rotationDegrees', [
        { time: 0, value: 24, ease: 'easeInOut' },
        { time: 2.3, value: 14, ease: 'easeInOut' },
        { time: 2.6, value: 26, ease: 'easeInOut' },
        { time: dur, value: 24 },
      ]);
    } else if (spec.mode === 'wave') {
      // Graceful articulated greeting wave on ARRIVED with cheerful open-hand splayed fingers
      pose(animation, 'Arm L', 'rotationDegrees', spec.armL);
      pose(animation, 'Forearm L', 'rotationDegrees', spec.forearmL);
      pose(animation, 'Hand L', 'rotationDegrees', spec.handL);
      setHandFingers('L', 8, [0.92, 0.95, 0.9], -24);
      setHandFingers('R', 16, [1.04, 1.08, 1.02], 36);
      key(animation, 'Arm R', 'rotationDegrees', [
        { time: 0, value: spec.armR, ease: 'easeInOut' },
        { time: 1.8, value: spec.armR - 6, ease: 'easeInOut' },
        { time: dur, value: spec.armR },
      ]);
      key(animation, 'Forearm R', 'rotationDegrees', [
        { time: 0, value: spec.forearmR, ease: 'easeInOut' },
        { time: 0.75, value: spec.forearmR - 18, ease: 'easeInOut' },
        { time: 1.5, value: spec.forearmR + 12, ease: 'easeInOut' },
        { time: 2.25, value: spec.forearmR - 14, ease: 'easeInOut' },
        { time: 3.0, value: spec.forearmR + 8, ease: 'easeInOut' },
        { time: dur, value: spec.forearmR },
      ]);
      key(animation, 'Hand R', 'rotationDegrees', [
        { time: 0, value: spec.handR, ease: 'easeInOut' },
        { time: 0.85, value: spec.handR - 16, ease: 'easeInOut' },
        { time: 1.6, value: spec.handR + 14, ease: 'easeInOut' },
        { time: 2.35, value: spec.handR - 12, ease: 'easeInOut' },
        { time: 3.1, value: spec.handR + 8, ease: 'easeInOut' },
        { time: dur, value: spec.handR },
      ]);
    } else if (spec.mode === 'ponder') {
      // Laptop open + left hand resting + right index finger gently poised near chin!
      pose(animation, 'Arm L', 'rotationDegrees', spec.armL);
      pose(animation, 'Forearm L', 'rotationDegrees', spec.forearmL);
      pose(animation, 'Hand L', 'rotationDegrees', spec.handL);
      setHandFingers('L', 9, [0.9, 0.92, 0.88], -22);
      setHandFingers('R', 8, [1.08, 0.74, 0.7], 18);
      key(animation, 'Arm R', 'rotationDegrees', [
        { time: 0, value: spec.armR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.armR + 4, ease: 'easeInOut' },
        { time: dur, value: spec.armR },
      ]);
      key(animation, 'Forearm R', 'rotationDegrees', [
        { time: 0, value: spec.forearmR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.forearmR + 5, ease: 'easeInOut' },
        { time: dur, value: spec.forearmR },
      ]);
      key(animation, 'Hand R', 'rotationDegrees', [
        { time: 0, value: spec.handR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.handR + 6, ease: 'easeInOut' },
        { time: dur, value: spec.handR },
      ]);
    } else if (spec.mode === 'speak' || spec.mode === 'guide' || spec.mode === 'newhome') {
      // Subtle, refined conversational & welcoming open hand gestures
      setHandFingers('L', 11, [0.96, 0.98, 0.94], -28);
      setHandFingers('R', 14, [1.02, 1.04, 0.98], 32);
      key(animation, 'Arm L', 'rotationDegrees', [
        { time: 0, value: spec.armL, ease: 'easeInOut' },
        { time: dur * 0.48, value: spec.armL - 5, ease: 'easeInOut' },
        { time: dur, value: spec.armL },
      ]);
      key(animation, 'Forearm L', 'rotationDegrees', [
        { time: 0, value: spec.forearmL, ease: 'easeInOut' },
        { time: dur * 0.52, value: spec.forearmL - 9, ease: 'easeInOut' },
        { time: dur, value: spec.forearmL },
      ]);
      key(animation, 'Hand L', 'rotationDegrees', [
        { time: 0, value: spec.handL, ease: 'easeInOut' },
        { time: dur * 0.55, value: spec.handL - 8, ease: 'easeInOut' },
        { time: dur, value: spec.handL },
      ]);
      key(animation, 'Arm R', 'rotationDegrees', [
        { time: 0, value: spec.armR, ease: 'easeInOut' },
        { time: dur * 0.45, value: spec.armR - 7, ease: 'easeInOut' },
        { time: dur, value: spec.armR },
      ]);
      key(animation, 'Forearm R', 'rotationDegrees', [
        { time: 0, value: spec.forearmR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.forearmR - 10, ease: 'easeInOut' },
        { time: dur, value: spec.forearmR },
      ]);
      key(animation, 'Hand R', 'rotationDegrees', [
        { time: 0, value: spec.handR, ease: 'easeInOut' },
        { time: dur * 0.54, value: spec.handR - 9, ease: 'easeInOut' },
        { time: dur, value: spec.handR },
      ]);
    } else if (spec.mode === 'travel') {
      // Calm scouting alternating stride poise
      setHandFingers('L', 8, [0.92, 0.94, 0.9], -24);
      setHandFingers('R', 8, [0.92, 0.94, 0.9], 24);
      key(animation, 'Arm L', 'rotationDegrees', [
        { time: 0, value: spec.armL - 5, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.armL + 6, ease: 'easeInOut' },
        { time: dur, value: spec.armL - 5 },
      ]);
      key(animation, 'Forearm L', 'rotationDegrees', [
        { time: 0, value: spec.forearmL, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.forearmL - 6, ease: 'easeInOut' },
        { time: dur, value: spec.forearmL },
      ]);
      pose(animation, 'Hand L', 'rotationDegrees', spec.handL);
      key(animation, 'Arm R', 'rotationDegrees', [
        { time: 0, value: spec.armR + 5, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.armR - 6, ease: 'easeInOut' },
        { time: dur, value: spec.armR + 5 },
      ]);
      key(animation, 'Forearm R', 'rotationDegrees', [
        { time: 0, value: spec.forearmR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.forearmR + 6, ease: 'easeInOut' },
        { time: dur, value: spec.forearmR },
      ]);
      pose(animation, 'Hand R', 'rotationDegrees', spec.handR);
    } else {
      // Serene organic breathing hand poise for rest, favorite, pricedrop, achieve, lookout, listen
      const openSpread = spec.mode === 'achieve' ? 16 : spec.mode === 'favorite' ? 6 : 9;
      const openScale: [number, number, number] =
        spec.mode === 'achieve' ? [1.04, 1.08, 1.02] : spec.mode === 'favorite' ? [0.84, 0.86, 0.82] : [0.92, 0.95, 0.9];
      setHandFingers('L', openSpread, openScale, spec.mode === 'achieve' ? -34 : -24);
      setHandFingers('R', openSpread, openScale, spec.mode === 'achieve' ? 34 : 24);
      key(animation, 'Arm L', 'rotationDegrees', [
        { time: 0, value: spec.armL, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.armL + 3, ease: 'easeInOut' },
        { time: dur, value: spec.armL },
      ]);
      key(animation, 'Forearm L', 'rotationDegrees', [
        { time: 0, value: spec.forearmL, ease: 'easeInOut' },
        { time: dur * 0.52, value: spec.forearmL - 4, ease: 'easeInOut' },
        { time: dur, value: spec.forearmL },
      ]);
      pose(animation, 'Hand L', 'rotationDegrees', spec.handL);
      key(animation, 'Arm R', 'rotationDegrees', [
        { time: 0, value: spec.armR, ease: 'easeInOut' },
        { time: dur * 0.5, value: spec.armR - 3, ease: 'easeInOut' },
        { time: dur, value: spec.armR },
      ]);
      key(animation, 'Forearm R', 'rotationDegrees', [
        { time: 0, value: spec.forearmR, ease: 'easeInOut' },
        { time: dur * 0.52, value: spec.forearmR + 4, ease: 'easeInOut' },
        { time: dur, value: spec.forearmR },
      ]);
      pose(animation, 'Hand R', 'rotationDegrees', spec.handR);
    }
  }
  poses('Emotion', 'emotion', reactions, 460);

  // LAYER 8: Backward-Compatible Accessory Override (`Accessory` layer driven by `laptopMode` input)
  // 0 = Auto (empty timeline so Emotion layer smoothly opens/closes laptop),
  // 1 = Force Closed (clamshell lid folded shut), 2 = Force Open (clamshell lid unfolded + screen glow).
  addAnimation(doc, { name: 'Laptop Auto', duration: 0.5, loop: 'loop' });
  addAnimation(doc, { name: 'Laptop Closed', duration: 0.5, loop: 'loop' });
  pose('Laptop Closed', 'Laptop rig', 'opacity', 0);
  pose('Laptop Closed', 'Laptop hinge', 'scaleY', 0.08);
  pose('Laptop Closed', 'Laptop rig', 'y', 39.5);
  pose('Laptop Closed', 'Laptop torso AO', 'opacity', 0);
  pose('Laptop Closed', 'Laptop face glow', 'opacity', 0);

  addAnimation(doc, { name: 'Laptop Open', duration: 3.4, loop: 'loop' });
  pose('Laptop Open', 'Laptop rig', 'opacity', 1);
  pose('Laptop Open', 'Laptop hinge', 'scaleY', 1);
  pose('Laptop Open', 'Laptop torso AO', 'opacity', 0.88);
  key('Laptop Open', 'Laptop rig', 'y', [
    { time: 0, value: 30.8, ease: 'easeInOut' },
    { time: 1.7, value: 29.9, ease: 'easeInOut' },
    { time: 3.4, value: 30.8 },
  ]);
  key('Laptop Open', 'Laptop face glow', 'opacity', [
    { time: 0, value: 0.76, ease: 'easeInOut' },
    { time: 1.6, value: 0.94, ease: 'easeInOut' },
    { time: 3.4, value: 0.76 },
  ]);

  const inputStates = (layerName: string, inputName: string, stateNames: string[], durationMs: number) => {
    layer(layerName);
    for (const animation of stateNames) addState(doc, { stateMachine: 'Guide', layer: layerName, animation });
    addTransition(doc, { stateMachine: 'Guide', layer: layerName, from: 'entry', to: stateNames[0]! });
    for (const from of stateNames) {
      for (const [i, to] of stateNames.entries()) {
        if (from !== to) {
          addTransition(doc, {
            stateMachine: 'Guide',
            layer: layerName,
            from,
            to,
            durationMs,
            conditions: [{ input: inputName, value: i }],
          });
        }
      }
    }
  };
  inputStates('Accessory', 'laptopMode', ['Laptop Auto', 'Laptop Closed', 'Laptop Open'], 420);

  // LAYER 9: Backward-Compatible Arm & Hand Gesture Override (`ArmGesture` layer driven by `armGesture` input)
  // 0 = Auto (empty timeline so Emotion layer drives arms), 1 = Wave, 2 = Typing, 3 = Ponder, 4 = Present, 5 = Celebrate
  addAnimation(doc, { name: 'Gesture Auto', duration: 0.5, loop: 'loop' });

  addAnimation(doc, { name: 'Gesture Wave', duration: 3.2, loop: 'loop' });
  pose('Gesture Wave', 'Arm L', 'rotationDegrees', 14);
  pose('Gesture Wave', 'Forearm L', 'rotationDegrees', -18);
  pose('Gesture Wave', 'Hand L', 'rotationDegrees', -4);
  pose('Gesture Wave', 'Arm R', 'rotationDegrees', -110);
  key('Gesture Wave', 'Forearm R', 'rotationDegrees', [
    { time: 0, value: -40, ease: 'easeInOut' },
    { time: 0.8, value: -58, ease: 'easeInOut' },
    { time: 1.6, value: -28, ease: 'easeInOut' },
    { time: 2.4, value: -54, ease: 'easeInOut' },
    { time: 3.2, value: -40 },
  ]);
  key('Gesture Wave', 'Hand R', 'rotationDegrees', [
    { time: 0, value: -8, ease: 'easeInOut' },
    { time: 0.85, value: -24, ease: 'easeInOut' },
    { time: 1.65, value: 8, ease: 'easeInOut' },
    { time: 2.45, value: -20, ease: 'easeInOut' },
    { time: 3.2, value: -8 },
  ]);

  addAnimation(doc, { name: 'Gesture Typing', duration: 2.8, loop: 'loop' });
  pose('Gesture Typing', 'Arm L', 'rotationDegrees', -26);
  pose('Gesture Typing', 'Arm R', 'rotationDegrees', 26);
  for (const side of ['L', 'R'] as const) {
    const left = side === 'L';
    const sign = left ? -1 : 1;
    const peaks = left ? [0.32, 1.44] : [0.88, 2.0];
    const tapKeys = (base: number, amount: number) => [
      { time: 0, value: base },
      ...peaks.flatMap((t) => [
        { time: Number((t - 0.12).toFixed(2)), value: base, ease: 'easeInOut' as const },
        { time: t, value: base + sign * amount, ease: 'easeInOut' as const },
        { time: Number((t + 0.16).toFixed(2)), value: base, ease: 'easeInOut' as const },
      ]),
      { time: 2.8, value: base },
    ];
    key('Gesture Typing', 'Forearm ' + side, 'rotationDegrees', tapKeys(sign * 28, 2.6));
    key('Gesture Typing', 'Hand ' + side, 'rotationDegrees', tapKeys(sign * 8, 5.2));
  }

  addAnimation(doc, { name: 'Gesture Ponder', duration: 4.0, loop: 'loop' });
  pose('Gesture Ponder', 'Arm L', 'rotationDegrees', -24);
  pose('Gesture Ponder', 'Forearm L', 'rotationDegrees', -26);
  pose('Gesture Ponder', 'Hand L', 'rotationDegrees', -8);
  key('Gesture Ponder', 'Arm R', 'rotationDegrees', [
    { time: 0, value: 40, ease: 'easeInOut' },
    { time: 2.0, value: 44, ease: 'easeInOut' },
    { time: 4.0, value: 40 },
  ]);
  key('Gesture Ponder', 'Forearm R', 'rotationDegrees', [
    { time: 0, value: 64, ease: 'easeInOut' },
    { time: 2.0, value: 69, ease: 'easeInOut' },
    { time: 4.0, value: 64 },
  ]);
  pose('Gesture Ponder', 'Hand R', 'rotationDegrees', 18);

  addAnimation(doc, { name: 'Gesture Present', duration: 3.8, loop: 'loop' });
  pose('Gesture Present', 'Arm L', 'rotationDegrees', 16);
  pose('Gesture Present', 'Forearm L', 'rotationDegrees', -24);
  pose('Gesture Present', 'Hand L', 'rotationDegrees', -6);
  key('Gesture Present', 'Arm R', 'rotationDegrees', [
    { time: 0, value: -62, ease: 'easeInOut' },
    { time: 1.9, value: -69, ease: 'easeInOut' },
    { time: 3.8, value: -62 },
  ]);
  key('Gesture Present', 'Forearm R', 'rotationDegrees', [
    { time: 0, value: -32, ease: 'easeInOut' },
    { time: 1.9, value: -42, ease: 'easeInOut' },
    { time: 3.8, value: -32 },
  ]);
  pose('Gesture Present', 'Hand R', 'rotationDegrees', -10);

  addAnimation(doc, { name: 'Gesture Celebrate', duration: 3.6, loop: 'loop' });
  key('Gesture Celebrate', 'Arm L', 'rotationDegrees', [
    { time: 0, value: 118, ease: 'easeInOut' },
    { time: 1.8, value: 124, ease: 'easeInOut' },
    { time: 3.6, value: 118 },
  ]);
  pose('Gesture Celebrate', 'Forearm L', 'rotationDegrees', 34);
  pose('Gesture Celebrate', 'Hand L', 'rotationDegrees', 8);
  key('Gesture Celebrate', 'Arm R', 'rotationDegrees', [
    { time: 0, value: -118, ease: 'easeInOut' },
    { time: 1.8, value: -124, ease: 'easeInOut' },
    { time: 3.6, value: -118 },
  ]);
  pose('Gesture Celebrate', 'Forearm R', 'rotationDegrees', -34);
  pose('Gesture Celebrate', 'Hand R', 'rotationDegrees', -8);

  inputStates('ArmGesture', 'armGesture', ['Gesture Auto', 'Gesture Wave', 'Gesture Typing', 'Gesture Ponder', 'Gesture Present', 'Gesture Celebrate'], 420);

  // LAYER 10: Backward-Compatible Over-Ear Working Headphones Override (`Headphones` layer driven by `headphonesMode`)
  // 0 = Auto (empty timeline so Emotion layer smoothly glides headphones on/off between resting and working),
  // 1 = Off, 2 = On (with gentle pulsing LED accent strips).
  addAnimation(doc, { name: 'Headphones Auto', duration: 0.5, loop: 'loop' });
  addAnimation(doc, { name: 'Headphones Off', duration: 0.5, loop: 'loop' });
  pose('Headphones Off', 'Headphones rig', 'opacity', 0);
  pose('Headphones Off', 'Headphones rig', 'y', -14);
  pose('Headphones Off', 'Headphones rig', 'scaleX', 0.92);
  pose('Headphones Off', 'Headphones rig', 'scaleY', 0.92);

  addAnimation(doc, { name: 'Headphones On', duration: 3.4, loop: 'loop' });
  pose('Headphones On', 'Headphones rig', 'opacity', 1);
  pose('Headphones On', 'Headphones rig', 'scaleX', 1);
  pose('Headphones On', 'Headphones rig', 'scaleY', 1);
  key('Headphones On', 'Headphones rig', 'y', [
    { time: 0, value: 0, ease: 'easeInOut' },
    { time: 1.7, value: 0.55, ease: 'easeInOut' },
    { time: 3.4, value: 0 },
  ]);
  key('Headphones On', 'HP led L', 'opacity', [
    { time: 0, value: 0.76, ease: 'easeInOut' },
    { time: 1.7, value: 1.0, ease: 'easeInOut' },
    { time: 3.4, value: 0.76 },
  ]);
  key('Headphones On', 'HP led R', 'opacity', [
    { time: 0, value: 0.76, ease: 'easeInOut' },
    { time: 1.7, value: 1.0, ease: 'easeInOut' },
    { time: 3.4, value: 0.76 },
  ]);

  inputStates('Headphones', 'headphonesMode', ['Headphones Auto', 'Headphones Off', 'Headphones On'], 440);

  // Rive component property keys: x=13, y=14, scaleX=16, scaleY=17, opacity=18.
  // MouthShape is intentionally diagnostic; it must not override live morphs.
  for (const target of new Set(pending.map((b) => b.target))) {
    const index = ab.objects.indexOf(target);
    if (index < 0) throw Error('Binding target missing: ' + target.id);
    const binds = pending
      .filter((b) => b.target === target)
      .map((b) => {
        const source = findProperty(doc, ab, b.source);
        if (!source) throw Error('Missing GuideVM property ' + b.source);
        return obj('DataBindContext', {
          propertyKey: b.propertyKey,
          sourcePathIds: encodePath([source.viewModelIndex, source.index]),
        });
      });
    ab.objects.splice(index + 1, 0, ...binds);
  }

  return doc;
}

export const questiePin: Template = {
  id: 'questie-pin',
  name: 'Questie Pin',
  description: 'Portable native OpenRive coral mascot with 4-layer autonomous state machine, articulated 2-segment arms & hands, laptop interaction, and 13-property GuideVM.',
  learn: ['Native multi-layer state machine', 'Articulated limbs & props', 'Continuous mouth deformation'],
  build: () => buildQuestieGuide('Pin'),
};

export const questieGeo: Template = {
  id: 'questie-geo',
  name: 'Questie Geo',
  description: 'Portable native OpenRive teal mascot with 4-layer autonomous state machine, articulated 2-segment arms & hands, laptop interaction, and 13-property GuideVM.',
  learn: ['Native multi-layer state machine', 'Articulated limbs & props', 'Continuous mouth deformation'],
  build: () => buildQuestieGuide('Geo'),
};
