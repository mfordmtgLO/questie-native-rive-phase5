// TypeScript declarations for Questie Living Mascot JS & React SDKs

export type BehaviorId =
  | 'IDLE-PARKED'
  | 'IDLE-LOOKOUT'
  | 'NAV-EXPLORE'
  | 'TYPE-LISTEN'
  | 'TYPE-PONDER'
  | 'WORK-THINK'
  | 'SPEAK-ATTEND'
  | 'FAVORITE'
  | 'PRICE DROP'
  | 'NEW HOME'
  | 'ARRIVED'
  | 'ACHIEVEMENT';

export interface BehaviorStateMeta {
  id: BehaviorId;
  label: string;
  emotion: number;
  verbal: boolean;
  category: string;
  note: string;
}

export interface VisemeCue {
  time: number;
  mouthShape: number;
}

export type LaptopMode = 'auto' | 'closed' | 'open';
export type ArmGesture = 'auto' | 'wave' | 'typing' | 'ponder' | 'present' | 'celebrate';

export interface AttachInputOptions {
  typingBehavior?: BehaviorId;
  pauseBehavior?: BehaviorId;
  listenBehavior?: BehaviorId;
  idleBehavior?: BehaviorId;
  submitBehavior?: BehaviorId;
  pauseMs?: number;
  idleMs?: number;
  processingMs?: number;
  submitHoldMs?: number;
  resolveSubmitBehavior?: (submittedText: string) => BehaviorId | null | undefined;
  onActivity?: (event: { phase: string; behavior: BehaviorId; text: string }) => void;
}

export interface MountQuestieOptions {
  canvas: HTMLCanvasElement;
  createPlayer: (opts: {
    canvas: HTMLCanvasElement;
    bytes?: Uint8Array;
    artboard?: string | number;
    stateMachine?: string | number;
    paused?: boolean;
  }) => Promise<any>;
  rivUrl?: string;
  bytes?: Uint8Array;
  artboard?: string | number;
  stateMachine?: string | number;
  initialBehavior?: BehaviorId;
  autoLife?: boolean;
  interactiveGaze?: boolean;
  pauseWhenOffscreen?: boolean;
  respectReducedMotion?: boolean;
  paused?: boolean;
  onPropertyChange?: (name: string, value: number) => void;
  onBehaviorChange?: (state: BehaviorStateMeta) => void;
}

export interface QuestieMascotController {
  readonly state: BehaviorStateMeta;
  readonly values: Record<string, number>;
  readonly isPaused: boolean;
  readonly isSpeaking: boolean;
  readonly isProcessing: boolean;
  readonly isReducedMotion: boolean;
  readonly laptopMode: LaptopMode;
  readonly armGesture: ArmGesture;
  setBehavior(id: BehaviorId, opts?: { preserveAudio?: boolean }): BehaviorStateMeta;
  setReaction(index: number): BehaviorStateMeta | null;
  setMouth(visemeIndex: number, opts?: { pin?: boolean }): void;
  setLaptopMode(mode: LaptopMode | number): LaptopMode;
  setArmGesture(gesture: ArmGesture | number): ArmGesture;
  setProcessing(active: boolean, completionBehavior?: BehaviorId): boolean;
  setProperty(name: string, value: number, opts?: { immediate?: boolean }): number;
  applyProperties(values: Record<string, number>, opts?: { immediate?: boolean }): void;
  getProperties(): Array<{ name: string; type: string; value: number }>;
  getInputs(): Array<{ name: string; type: string; value: number | boolean }>;
  lookAt(x: number, y: number): void;
  releaseGaze(): void;
  triggerBlink(doubleBlink?: boolean): void;
  notifyTypingActivity(cursorRatio?: number, opts?: { behaviorId?: BehaviorId }): void;
  attachInput(inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLElement, opts?: AttachInputOptions): () => void;
  speakWithAudio(audioEl: HTMLAudioElement, cues: VisemeCue[], opts?: { switchBehavior?: boolean; onEnd?: () => void }): Promise<void>;
  speakWithCues(cues: VisemeCue[], opts?: { duration?: number; switchBehavior?: boolean; onEnd?: () => void }): void;
  stopSpeaking(opts?: { restoreBehavior?: boolean }): void;
  setAutoLife(enabled: boolean): void;
  pause(): void;
  play(): void;
  dispose(): void;
}

export const BEHAVIOR_STATES: BehaviorStateMeta[];
export const BEHAVIOR_BY_ID: Record<BehaviorId, BehaviorStateMeta>;
export function behaviorForEmotion(emotionIndex: number): BehaviorStateMeta;
export function mountQuestieMascot(options: MountQuestieOptions): Promise<QuestieMascotController>;
export function createQuestieReactSDK<R>(reactModule: R): {
  QuestieMascot: any;
  useQuestieMascot: (options: any) => any;
  BEHAVIOR_STATES: BehaviorStateMeta[];
  BEHAVIOR_BY_ID: Record<BehaviorId, BehaviorStateMeta>;
  behaviorForEmotion: (emotionIndex: number) => BehaviorStateMeta;
};
