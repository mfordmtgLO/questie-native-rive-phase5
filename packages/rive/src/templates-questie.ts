// Phase 5 Pin & Geo living mascot rigs authored with OpenRive's native document API.
// All drawing coordinates are in a 128x136 logical artboard.
// Preserves the exact 13-property GuideVM contract, 8 visemes, 13 reactions,
// continuous mouth deformation, round glowing status ball, and original Pin/Geo identities.
import {
  addAnimation,
  addDataProperty,
  addGroup,
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
    shellColor: pin ? '#e95d65' : '#159f9d',
    shellEdge: pin ? '#9c2c49' : '#0f5c70',
    shellLight: pin ? '#ffc3b8' : '#9ff7e4',
    beaconColor: '#24e3ca',
    showBackpack: true,
    backpackColor: pin ? '#b98245' : '#a87844',
    blushColor: pin ? '#ff9ca8' : '#ff9eb2',
    glossOpacity: 0.56,
    irisColor: pin ? '#213948' : '#1b3847',
    irisRingColor: pin ? '#45788f' : '#2d8994',
    scleraColor: '#fffaf0',
    eyeScale: 1,
    irisScale: 1,
    glintStyle: 'muse',
    browThickness: 2.1,
    browArch: 0,
    parallaxDepth: 1,
    eyeTrackingRange: 1,
    breathingScale: 1,
    mouthScale: 1,
  };
}

function clampNum(v: number, min: number, max: number) {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

function hexWithAlpha(hex: string, alphaHex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  const rgb = clean.length >= 6 ? clean.slice(0, 6) : 'ffffff';
  return `#${rgb}${alphaHex}`;
}

function shadeHex(hex: string, factor: number): string {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length < 6) return hex;
  const r = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

  const base = cfg.shellColor;
  const edge = cfg.shellEdge;
  const hi = cfg.shellLight;
  const deepShadow = shadeHex(edge, 0.68);
  const backpackDark = shadeHex(cfg.backpackColor, 0.68);
  const backpackLight = shadeHex(cfg.backpackColor, 1.22);
  const scleraEdge = shadeHex(cfg.scleraColor, 0.88);
  const irisDeep = shadeHex(cfg.irisColor, 0.55);

  defineColor(doc, 'Background', '#0c151f');
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

  // A scaled parent and inverse-scaled child convert normalized positions
  // to drawing units while leaving artwork size unchanged. No legacy inputs.
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

  const moving = (nodeName: string, xf: number, yf: number, bf: number, head = false) => {
    g(nodeName + ' parallax', 64, 70);
    const breathed = shift(nodeName + ' breath', nodeName + ' parallax', 1, bf * breathScale, undefined, 'breath');
    const parent = head ? shift(nodeName + ' head', breathed, xf * depth, yf * depth, 'headX', 'headY') : breathed;
    g(nodeName + ' motion', 0, 0, parent);
  };

  // Ordered back-to-front; OpenRive inserts new drawables in front of older ones.
  // Soft ambient ground contact shadow
  const shadow = e('Ground shadow', 64, 120, 90, 14, null);
  addRadialFill(shadow, 0, 0, 45, 0, [
    [0, '#040b12cc'],
    [0.55, '#06111a77'],
    [1, '#06111a00'],
  ]);

  // Plane 1: Torso & lower limbs with subtle counter-parallax and gentle breath lift
  moving('Body', 0.65, 0.4, 0.48, true);

  for (const [side, x] of [['L', -22], ['R', 22]] as const) {
    const footBase = e('Foot ' + side, x, 34, 26, 15, null, 'Body motion');
    addRadialFill(footBase, -4, -4, 16, 10, [
      [0, base],
      [0.55, edge],
      [1, deepShadow],
    ]);
    const footTop = e('Foot highlight ' + side, x, 31.5, 21, 10.5, null, 'Body motion');
    addRadialFill(footTop, -3, -3, 12, 8, [
      [0, hi],
      [0.45, base],
      [1, edge],
    ]);
  }

  // Plane 0 (back): Explorer backpack with inverse horizontal parallax for 3D turn illusion
  if (cfg.showBackpack) {
    const backpack = shift('Backpack parallax', 'Body motion', -2.8 * depth, -0.7 * depth, 'headX', 'headY');
    const packBody = r('Backpack', 30, 3, 22, 31, null, 9.5, backpack);
    addLinearFill(packBody, -10, -15, 11, 16, [
      [0, backpackLight],
      [0.45, cfg.backpackColor],
      [1, backpackDark],
    ]);
    const packFlap = r('Backpack flap', 30, -5.5, 20, 10, null, 5, backpack);
    addLinearFill(packFlap, -8, -5, 8, 5, [
      [0, backpackLight],
      [1, cfg.backpackColor],
    ]);
    r('Backpack strap', 30, -2.5, 13, 2.2, '#ffe4a6', 1.1, backpack);
    r('Backpack buckle', 30, -1, 5.2, 4.2, '#ffd479', 1.4, backpack);
  }

  // Sculpted 3D arms with radial shading
  for (const [side, x, rotation] of [['L', -39.5, 18], ['R', 39.5, -18]] as const) {
    g('Arm ' + side, x, 5, 'Body motion');
    const arm = e('Arm shell ' + side, 0, 2, 16.5, 22, null, 'Arm ' + side);
    arm.props.rotation = (rotation * Math.PI) / 180;
    addRadialFill(arm, side === 'L' ? -3 : -4, -6, 12, 14, [
      [0, hi],
      [0.32, base],
      [0.82, edge],
      [1, deepShadow],
    ]);
  }

  // Plane 2: Head shell, antenna, and preserved round glowing status ball
  moving('Head', 1.85, 0.95, 0.75, true);

  // Subtle ambient backlight behind status ball
  const haloAura = e('Halo aura', 0, -56, 34, 34, null, 'Head motion');
  addRadialFill(haloAura, 0, 0, 17, 0, [
    [0, hexWithAlpha(cfg.beaconColor, '52')],
    [0.55, hexWithAlpha(cfg.beaconColor, '1a')],
    [1, hexWithAlpha(cfg.beaconColor, '00')],
  ]);

  // Antenna stem & metallic collar
  const antenna = r('Antenna', 0, -46.5, 6.4, 21, null, 3.2, 'Head motion');
  addLinearFill(antenna, -3.2, 0, 3.2, 0, [
    [0, hi],
    [0.45, edge],
    [1, deepShadow],
  ]);
  const collar = e('Antenna collar', 0, -37.5, 13, 5.5, null, 'Head motion');
  addLinearFill(collar, -6, 0, 6, 0, [
    [0, hi],
    [0.5, edge],
    [1, deepShadow],
  ]);

  // Preserved round glowing status ball (solid fill animated by Emotion state machine + 3D dome glass overlay)
  e('Halo', 0, -56, 25, 25, hexWithAlpha(cfg.beaconColor, '36'), 'Head motion');
  e('Beacon', 0, -56, 17.5, 17.5, cfg.beaconColor, 'Head motion');
  const beaconDome = e('Beacon dome', 0, -56, 17.5, 17.5, null, 'Head motion');
  addRadialFill(beaconDome, -4, -4.5, 10, 10, [
    [0, '#ffffffcc'],
    [0.35, '#ffffff22'],
    [0.78, '#00000018'],
    [1, '#00000055'],
  ]);
  e('Beacon highlight', -3, -59.2, 5.4, 4.4, '#f4fffc', 'Head motion').props.opacity = 0.92;

  // Sculpted 3D Shell (Pin teardrop vs Geo rounded orb) with multi-stop RadialGradient
  const shell = pin
    ? addPath(doc, {
        parent: 'Head motion',
        name: 'Shell',
        fill: null,
        stroke: edge,
        strokeWidth: 1.5,
        points: [
          { x: 0, y: -40, inX: -27, inY: 0, outX: 27, outY: 0 },
          { x: 35.5, y: -2, inX: 4, inY: -21, outX: -3, outY: 17 },
          { x: 0, y: 42, inX: 17, inY: -21, outX: -17, outY: -21 },
          { x: -35.5, y: -2, inX: 3, inY: 17, outX: -4, outY: -21 },
        ],
      })
    : addShape(doc, {
        parent: 'Head motion',
        name: 'Shell',
        kind: 'ellipse',
        x: 0,
        y: -2,
        width: 75,
        height: 79,
        fill: null,
        stroke: edge,
        strokeWidth: 1.5,
      });
  addRadialFill(shell, -14, -24, 42, 44, [
    [0, hi],
    [0.28, base],
    [0.78, edge],
    [1, deepShadow],
  ]);

  // Subtle underside studio rim light for 3D form separation
  const rimLight = e('Shell rim light', 0, pin ? 22 : 25, pin ? 34 : 48, 12, null, 'Head motion');
  addRadialFill(rimLight, 0, 4, 24, 0, [
    [0, hexWithAlpha(hi, '48')],
    [0.7, hexWithAlpha(hi, '12')],
    [1, hexWithAlpha(hi, '00')],
  ]);

  // Sculpted upper-left glossy studio specular sheen
  const sheen = e('Shell sheen', -12.5, -26.5, 36, 10.5, null, 'Head motion');
  sheen.props.rotation = (-14 * Math.PI) / 180;
  addRadialFill(
    sheen,
    -4,
    -2,
    18,
    4,
    [
      [0, '#ffffffcc'],
      [0.55, hexWithAlpha(hi, '77')],
      [1, hexWithAlpha(hi, '00')],
    ],
    glossOpacity,
  );

  // Plane 3: Mid-face depth layer (soft warm blush & speaking warmth)
  moving('MidFace', 3.1, 1.55, 0.82, true);
  for (const [side, x] of [['L', -24.5], ['R', 24.5]] as const) {
    const cheek = e('Cheek ' + side, x, 0.5, 13.5, 7.2, null, 'MidFace motion');
    addRadialFill(cheek, 0, 0, 7, 0, [
      [0, hexWithAlpha(cfg.blushColor, '99')],
      [0.65, hexWithAlpha(cfg.blushColor, '33')],
      [1, hexWithAlpha(cfg.blushColor, '00')],
    ]);
    const blush = e('Speech blush ' + side, x, 0.5, 15, 8.2, hexWithAlpha(cfg.blushColor, '66'), 'MidFace motion');
    blush.props.opacity = 0;
    bind(blush, 18, 'speaking');
  }

  // Plane 4: Foreground expressive face plane (high differential parallax for simulated 3D depth)
  moving('Face', 4.4, 2.3, 0.88, true);

  for (const [side, x] of [['L', -15], ['R', 15]] as const) {
    // Eyebrow rig with subtle vertical gaze lift + reaction-driven expressive rotation/height
    const browLift = shift('Brow lift ' + side, 'Face motion', 0.45 * eyeTrack, 1.35 * eyeTrack, 'lookX', 'lookY');
    g('Brow rig ' + side, x, -26.5, browLift);
    const archY = -4 - browArch;
    addPath(doc, {
      parent: 'Brow rig ' + side,
      name: 'Brow ' + side,
      x: 0,
      y: 0,
      closed: false,
      fill: null,
      stroke: deepShadow,
      strokeWidth: browThickness,
      points: [
        { x: -7.2, y: 0.4, outX: 3.2, outY: archY },
        { x: 7.2, y: 0.4, inX: -3.2, inY: archY },
      ],
    });

    // Eye socket group scaled by eyeScale
    const eyeGroup = g('Eye ' + side, x, -12.8, 'Face motion');
    eyeGroup.props.scaleX = eyeScale;
    eyeGroup.props.scaleY = eyeScale;

    // Soft eye-socket recessed shadow
    const socket = e('Eye socket ' + side, 0, -0.6, 19.6, 21.6, null, 'Eye ' + side);
    addRadialFill(socket, 0, -2, 11, 10, [
      [0, hexWithAlpha(deepShadow, '55')],
      [0.75, hexWithAlpha(deepShadow, '28')],
      [1, hexWithAlpha(deepShadow, '00')],
    ]);

    // 3D curved sclera with subtle top-lid ambient shading
    const sclera = e('Sclera ' + side, 0, 0, 18.2, 20.2, null, 'Eye ' + side);
    addRadialFill(sclera, -2, 2, 11, 12, [
      [0, cfg.scleraColor],
      [0.72, cfg.scleraColor],
      [1, scleraEdge],
    ]);

    // Independent pupil & iris tracking plane (foreground parallax over sclera)
    const pupil = shift('Pupil ' + side, 'Eye ' + side, 3.55 * eyeTrack, 2.55 * eyeTrack, 'lookX', 'lookY');
    const irisRig = g('Iris rig ' + side, 0, 0.8, pupil);
    irisRig.props.scaleX = irisScale;
    irisRig.props.scaleY = irisScale;

    // Multi-layer expressive iris (deep limbal edge -> rich iris -> luminous lower catchlight)
    const iris = e('Iris ' + side, 0, 0, 11.4, 13.6, null, 'Iris rig ' + side);
    addRadialFill(iris, 0, 2.2, 7.2, 7.4, [
      [0, cfg.irisRingColor],
      [0.58, cfg.irisColor],
      [1, irisDeep],
    ]);
    // Deep velvety pupil core
    e('Pupil core ' + side, 0, -0.2, 5.4, 6.4, '#0c161e', 'Iris rig ' + side);

    // Customizable specular eye glints
    if (cfg.glintStyle === 'muse') {
      e('Eye glint ' + side, -2.1, -2.6, 3.9, 3.9, '#ffffff', 'Iris rig ' + side);
      e('Eye glint small ' + side, 2.2, 3.2, 1.7, 1.7, '#d9f6fc', 'Iris rig ' + side).props.opacity = 0.9;
      e('Eye catchlight ' + side, 0, 4.4, 4.4, 1.5, hexWithAlpha(cfg.irisRingColor, 'cc'), 'Iris rig ' + side);
    } else if (cfg.glintStyle === 'studio') {
      const studioGlint = e('Eye glint ' + side, -1.8, -2.5, 4.8, 3.0, '#ffffff', 'Iris rig ' + side);
      studioGlint.props.rotation = (-22 * Math.PI) / 180;
      studioGlint.props.opacity = 0.92;
      e('Eye glint small ' + side, 2.3, 2.8, 1.5, 1.5, '#e8fbff', 'Iris rig ' + side).props.opacity = 0.78;
    } else {
      e('Eye glint ' + side, -1.9, -2.2, 3.8, 3.8, '#ffffff', 'Iris rig ' + side);
      e('Eye glint small ' + side, 2.0, 3.4, 1.5, 1.5, '#a8d2dc', 'Iris rig ' + side);
    }

    // Velvety blink eyelid cover bound to GuideVM `blink` (scaleY = propertyKey 17)
    const lid = g('Lid ' + side, 0, 0, 'Eye ' + side);
    lid.props.scaleY = 0;
    const lidCover = e('Lid cover ' + side, 0, 0, 19.2, 21.2, null, 'Lid ' + side);
    addRadialFill(lidCover, -3, -5, 12, 12, [
      [0, hi],
      [0.35, base],
      [1, edge],
    ]);
    r('Closed eye ' + side, 0, 0.4, 13.4, 1.7, deepShadow, 0.85, 'Lid ' + side);
    bind(lid, 17, 'blink');
  }

  // One native mouth silhouette: continuous deformation of the same geometry
  // (mouthScale wrapper keeps GuideVM mouthWide/mouthOpen normalized in 0..1)
  const mouthFrame = g('Mouth frame', 0, 4.2, 'Face motion');
  mouthFrame.props.scaleX = mouthScale;
  mouthFrame.props.scaleY = mouthScale;

  const mouth = g('Mouth rig', 0, 0, 'Mouth frame');
  mouth.props.scaleX = GUIDE_PROPERTIES.mouthWide;
  mouth.props.scaleY = GUIDE_PROPERTIES.mouthOpen;
  bind(mouth, 16, 'mouthWide');
  bind(mouth, 17, 'mouthOpen');

  const cavity = e('Mouth cavity', 0, 0, 20, 12, null, 'Mouth rig');
  addRadialFill(cavity, 0, -2, 11, 8, [
    [0, '#5a2b3d'],
    [0.65, '#421d2c'],
    [1, '#2b101b'],
  ]);
  const teeth = r('Mouth teeth', 0, -2.4, 11.8, 2.9, '#fff7ed', 1.45, 'Mouth rig');
  teeth.props.opacity = 0;
  bind(teeth, 18, 'teeth');
  const tongue = e('Mouth tongue', 0, 2.8, 10.8, 3.8, null, 'Mouth rig');
  addRadialFill(tongue, 0, -1, 6, 3, [
    [0, '#ff9fb0'],
    [0.7, '#e7788e'],
    [1, '#b84c66'],
  ]);
  tongue.props.opacity = 0;
  bind(tongue, 18, 'tongue');

  // Animations & State Machine (`Guide`)
  const key = (
    animation: string,
    object: string,
    property: string,
    keys: Parameters<typeof addKeyframes>[1]['keys'],
  ) => addKeyframes(doc, { animation, object, property, keys });
  const pose = (animation: string, object: string, property: string, value: number | string) =>
    key(animation, object, property, [{ frame: 0, value }]);

  addAnimation(doc, { name: 'Breathe', duration: 4, loop: 'loop' });
  // Host drives continuous organic breathing & blinking via GuideVM.
  // Keep a gentle floor-shadow counter-breath on the idle layer.
  key('Breathe', 'Ground shadow', 'scaleX', [
    { time: 0, value: 1, ease: 'easeInOut' },
    { time: 2, value: 0.96, ease: 'easeInOut' },
    { time: 4, value: 1 },
  ]);

  addAnimation(doc, { name: 'Blink', duration: 4.6, loop: 'loop' });
  for (const side of ['L', 'R']) {
    key('Blink', 'Eye ' + side, 'scaleY', [
      { frame: 0, value: eyeScale },
      { frame: 157, value: eyeScale },
      { frame: 162, value: eyeScale * 0.06 },
      { frame: 169, value: eyeScale },
      { frame: 276, value: eyeScale },
    ]);
  }

  const sm = addStateMachine(doc, { name: 'Guide' });
  sm.children!.find((c) => c.type === 'StateMachineLayer')!.props.name = 'Idle';
  const layer = (layerName: string) => {
    sm.children!.push(newLayer(layerName));
  };
  const start = (layerName: string, animation: string) => {
    addState(doc, { stateMachine: 'Guide', layer: layerName, animation });
    addTransition(doc, { stateMachine: 'Guide', layer: layerName, from: 'entry', to: animation });
  };
  start('Idle', 'Breathe');

  // Each property switches a dedicated layer, so speech never interrupts blinking or breathing.
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
    addAnimation(doc, { name: animation, duration: 0.12, loop: 'oneShot' });
    const [, rx, ry, t, tg] = GUIDE_MOUTHS[i]!;
    pose(animation, 'Mouth rig', 'scaleX', rx / 10);
    pose(animation, 'Mouth rig', 'scaleY', ry / 6);
    pose(animation, 'Mouth teeth', 'opacity', t);
    pose(animation, 'Mouth tongue', 'opacity', tg);
  }

  // Subtle Muse-style reaction poses: refined head tilt, asymmetric eyebrow expressions,
  // gentle torso/arm poise, and smooth glowing status beacon color transitions.
  interface ReactionPoseSpec {
    headTilt: number;
    faceTilt: number;
    bodyTilt: number;
    browLY: number;
    browRY: number;
    browLRot: number;
    browRRot: number;
    armL: number;
    armR: number;
  }

  const reactionSpecs: ReactionPoseSpec[] = [
    // 0 ready (IDLE-PARKED)
    { headTilt: 0, faceTilt: 0, bodyTilt: 0, browLY: -26.5, browRY: -26.5, browLRot: 0, browRRot: 0, armL: 0, armR: 0 },
    // 1 thinking (WORK-THINK) — subtle contemplative tilt, asymmetric brows
    { headTilt: -4.2, faceTilt: -4.8, bodyTilt: -1.2, browLY: -25.4, browRY: -27.8, browLRot: 6, browRRot: -4, armL: 4, armR: -4 },
    // 2 listening (TYPE-LISTEN) — warm attentive lean-in
    { headTilt: 2.6, faceTilt: 3.1, bodyTilt: 0.9, browLY: -27.6, browRY: -27.6, browLRot: -3, browRRot: 3, armL: 3, armR: -3 },
    // 3 favorite (FAVORITE) — affectionate tilt, soft joyful brow lift
    { headTilt: 3.4, faceTilt: 3.9, bodyTilt: 1.4, browLY: -28.4, browRY: -28.4, browLRot: -5, browRRot: 5, armL: 10, armR: -10 },
    // 4 pricedrop (PRICE DROP) — crisp alert intrigue, raised brows
    { headTilt: -2.8, faceTilt: -3.2, bodyTilt: -0.8, browLY: -29.1, browRY: -29.1, browLRot: -4, browRRot: 4, armL: 7, armR: -7 },
    // 5 newhome (NEW HOME) — hopeful discovery, open welcoming poise
    { headTilt: 3.2, faceTilt: 3.6, bodyTilt: 1.2, browLY: -28.6, browRY: -28.2, browLRot: -5, browRRot: 3, armL: 12, armR: -6 },
    // 6 traveling (NAV-EXPLORE) — subtle forward exploratory poise
    { headTilt: 3.8, faceTilt: 4.3, bodyTilt: 1.8, browLY: -27.4, browRY: -27.0, browLRot: -2, browRRot: 2, armL: -5, armR: 6 },
    // 7 arrived (ARRIVED) — calm grounded welcome, graceful right arm greet
    { headTilt: 1.8, faceTilt: 2.1, bodyTilt: 0.6, browLY: -28.0, browRY: -28.0, browLRot: -4, browRRot: 4, armL: 4, armR: -18 },
    // 8 achievement (ACHIEVEMENT) — dignified pride, poised lift
    { headTilt: 3.6, faceTilt: 4.1, bodyTilt: 1.5, browLY: -28.9, browRY: -28.9, browLRot: -6, browRRot: 6, armL: 14, armR: -19 },
    // 9 guide (GUIDE) — gentle presenting tilt
    { headTilt: -2.2, faceTilt: -2.5, bodyTilt: -0.7, browLY: -27.8, browRY: -27.8, browLRot: -3, browRRot: 3, armL: 2, armR: -14 },
    // 10 lookout (IDLE-LOOKOUT) — subtle curious scanning tilt
    { headTilt: -2.9, faceTilt: -3.4, bodyTilt: -0.9, browLY: -27.9, browRY: -27.3, browLRot: -4, browRRot: 2, armL: 2, armR: -2 },
    // 11 ponder (TYPE-PONDER) — quiet reflection, gentle tilt
    { headTilt: -4.8, faceTilt: -5.3, bodyTilt: -1.4, browLY: -25.8, browRY: -28.2, browLRot: 7, browRRot: -5, armL: 5, armR: -3 },
    // 12 speaking (SPEAK-ATTEND) — engaged conversational presence
    { headTilt: 1.6, faceTilt: 1.9, bodyTilt: 0.6, browLY: -27.8, browRY: -27.8, browLRot: -3, browRRot: 3, armL: 5, armR: -7 },
  ];

  const reactions = GUIDE_REACTIONS.map((rx) => 'Reaction ' + rx[0]);
  for (const [i, animation] of reactions.entries()) {
    addAnimation(doc, { name: animation, duration: 0.34, loop: 'oneShot' });
    const color = i === 0 ? cfg.beaconColor : GUIDE_REACTIONS[i]![1];
    const spec = reactionSpecs[i] ?? reactionSpecs[0]!;
    pose(animation, 'Beacon', 'fill', color);
    pose(animation, 'Halo', 'fill', hexWithAlpha(color, '38'));
    pose(animation, 'Body motion', 'rotationDegrees', spec.bodyTilt);
    pose(animation, 'Head motion', 'rotationDegrees', spec.headTilt);
    pose(animation, 'MidFace motion', 'rotationDegrees', spec.headTilt * 1.05);
    pose(animation, 'Face motion', 'rotationDegrees', spec.faceTilt);
    pose(animation, 'Brow rig L', 'y', spec.browLY);
    pose(animation, 'Brow rig R', 'y', spec.browRY);
    pose(animation, 'Brow rig L', 'rotationDegrees', spec.browLRot);
    pose(animation, 'Brow rig R', 'rotationDegrees', spec.browRRot);
    pose(animation, 'Arm L', 'rotationDegrees', spec.armL);
    pose(animation, 'Arm R', 'rotationDegrees', spec.armR);
  }
  poses('Emotion', 'emotion', reactions, 260);

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
  description: 'Coral 3D-shaded home guide with multilayer parallax, subtle Muse-style expressions, and 13-property GuideVM.',
  learn: ['Native data properties', 'Continuous mouth deformation', 'Multilayer 3D parallax'],
  build: () => buildQuestieGuide('Pin'),
};

export const questieGeo: Template = {
  id: 'questie-geo',
  name: 'Questie Geo',
  description: 'Teal 3D-shaded home guide with multilayer parallax, subtle Muse-style expressions, and 13-property GuideVM.',
  learn: ['Native data properties', 'Continuous mouth deformation', 'Multilayer 3D parallax'],
  build: () => buildQuestieGuide('Geo'),
};
