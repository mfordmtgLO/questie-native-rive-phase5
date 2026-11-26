// Questie Portable React SDK — Phase 5.2
// Zero-JSX pure ESM React bindings for embedding native OpenRive Pin & Geo mascots into
// React 18 / 19 applications (Next.js, Vite, FTHB+House Finder, FTHB+Hub, Geosphere, Vantage Forge).
//
// Usage in React / Next.js:
//   import React, { useRef } from 'react';
//   import { createPlayer } from './questie-pin/index.js';
//   import { createQuestieReactSDK } from './questie-react.js';
//
//   const { QuestieMascot, useQuestieMascot } = createQuestieReactSDK(React);
//
//   export function SearchCompanion() {
//     const inputRef = useRef(null);
//     return (
//       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
//         <QuestieMascot createPlayer={createPlayer} inputRef={inputRef} size={140} />
//         <input ref={inputRef} placeholder="Ask Pin about homes..." />
//       </div>
//     );
//   }

import { mountQuestieMascot, BEHAVIOR_STATES, BEHAVIOR_BY_ID, behaviorForEmotion } from './questie-sdk.js';

export { mountQuestieMascot, BEHAVIOR_STATES, BEHAVIOR_BY_ID, behaviorForEmotion };

/**
 * Creates React 18/19-compatible `QuestieMascot` component and `useQuestieMascot` hook
 * bound to the host application's React instance (zero duplicate React bundles).
 */
export function createQuestieReactSDK(React) {
  if (!React || typeof React.useEffect !== 'function' || typeof React.createElement !== 'function') {
    throw new Error('createQuestieReactSDK(React) requires a valid React module');
  }

  const { useEffect, useRef, useState, useImperativeHandle, forwardRef, createElement } = React;

  /**
   * Hook for mounting and controlling a native Questie .riv mascot directly inside any React component.
   */
  function useQuestieMascot(options = {}) {
    const canvasRef = useRef(null);
    const mascotRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    const [activeBehavior, setActiveBehavior] = useState(options.initialBehavior || 'IDLE-PARKED');

    const {
      createPlayer,
      rivUrl,
      bytes,
      artboard,
      stateMachine = 'Guide',
      initialBehavior = 'IDLE-PARKED',
      autoLife = true,
      interactiveGaze = true,
      pauseWhenOffscreen = true,
      respectReducedMotion = true,
      paused = false,
      laptopMode = 'auto',
      armGesture = 'auto',
      processing = false,
      inputRef,
      inputOptions,
      onReady,
      onBehaviorChange,
      onError,
    } = options;

    useEffect(() => {
      let cancelled = false;
      let detachInput = null;
      const canvas = canvasRef.current;
      if (!canvas || typeof createPlayer !== 'function') return undefined;

      setReady(false);
      setError(null);

      mountQuestieMascot({
        canvas,
        createPlayer,
        rivUrl,
        bytes,
        artboard,
        stateMachine,
        initialBehavior,
        autoLife,
        interactiveGaze,
        pauseWhenOffscreen,
        respectReducedMotion,
        paused,
        onBehaviorChange: (st) => {
          setActiveBehavior(st.id);
          if (typeof onBehaviorChange === 'function') onBehaviorChange(st);
        },
      })
        .then((instance) => {
          if (cancelled) {
            instance.dispose();
            return;
          }
          mascotRef.current = instance;
          if (inputRef?.current) {
            detachInput = instance.attachInput(inputRef.current, inputOptions || {});
          }
          setReady(true);
          if (typeof onReady === 'function') onReady(instance);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err);
          if (typeof onError === 'function') onError(err);
        });

      return () => {
        cancelled = true;
        if (detachInput) detachInput();
        if (mascotRef.current) {
          mascotRef.current.dispose();
          mascotRef.current = null;
        }
      };
    }, [createPlayer, rivUrl, bytes, artboard, stateMachine]);

    useEffect(() => {
      mascotRef.current?.setAutoLife(autoLife);
    }, [autoLife]);

    useEffect(() => {
      if (!mascotRef.current) return;
      if (paused) mascotRef.current.pause();
      else mascotRef.current.play();
    }, [paused]);

    useEffect(() => {
      mascotRef.current?.setLaptopMode(laptopMode);
    }, [laptopMode, ready]);

    useEffect(() => {
      mascotRef.current?.setArmGesture(armGesture);
    }, [armGesture, ready]);

    useEffect(() => {
      if (!mascotRef.current) return;
      if (processing) mascotRef.current.setProcessing(true);
    }, [processing, ready]);

    useEffect(() => {
      const instance = mascotRef.current;
      if (!ready || !instance || !inputRef?.current) return undefined;
      return instance.attachInput(inputRef.current, inputOptions || {});
    }, [ready, inputRef?.current]);

    return {
      canvasRef,
      mascotRef,
      ready,
      error,
      activeBehavior,
      setBehavior: (id) => mascotRef.current?.setBehavior(id),
      setLaptopMode: (mode) => mascotRef.current?.setLaptopMode(mode),
      setArmGesture: (gesture) => mascotRef.current?.setArmGesture(gesture),
      setProcessing: (active, completion) => mascotRef.current?.setProcessing(active, completion),
      triggerBlink: (doubleBlink = false) => mascotRef.current?.triggerBlink(doubleBlink),
      speakWithAudio: (audioEl, cues, opts) => mascotRef.current?.speakWithAudio(audioEl, cues, opts),
      speakWithCues: (cues, opts) => mascotRef.current?.speakWithCues(cues, opts),
      stopSpeaking: (opts) => mascotRef.current?.stopSpeaking(opts),
    };
  }

  /**
   * Drop-in React component rendering a native OpenRive living Questie mascot.
   */
  const QuestieMascot = forwardRef(function QuestieMascot(props, ref) {
    const {
      createPlayer,
      rivUrl,
      bytes,
      artboard,
      stateMachine = 'Guide',
      behavior,
      initialBehavior = 'IDLE-PARKED',
      autoLife = true,
      interactiveGaze = true,
      pauseWhenOffscreen = true,
      respectReducedMotion = true,
      paused = false,
      laptopMode = 'auto',
      armGesture = 'auto',
      processing = false,
      inputRef,
      inputOptions,
      size = 96,
      width,
      height,
      className,
      style,
      ariaLabel = 'Animated Questie living mascot',
      onReady,
      onBehaviorChange,
      onError,
    } = props;

    const hook = useQuestieMascot({
      createPlayer,
      rivUrl,
      bytes,
      artboard,
      stateMachine,
      initialBehavior: behavior || initialBehavior,
      autoLife,
      interactiveGaze,
      pauseWhenOffscreen,
      respectReducedMotion,
      paused,
      laptopMode,
      armGesture,
      processing,
      inputRef,
      inputOptions,
      onReady,
      onBehaviorChange,
      onError,
    });

    useEffect(() => {
      if (behavior && hook.mascotRef.current) {
        hook.mascotRef.current.setBehavior(behavior);
      }
    }, [behavior, hook.ready]);

    useImperativeHandle(
      ref,
      () => ({
        get instance() {
          return hook.mascotRef.current;
        },
        setBehavior: hook.setBehavior,
        setLaptopMode: hook.setLaptopMode,
        setArmGesture: hook.setArmGesture,
        setProcessing: hook.setProcessing,
        triggerBlink: hook.triggerBlink,
        speakWithAudio: hook.speakWithAudio,
        speakWithCues: hook.speakWithCues,
        stopSpeaking: hook.stopSpeaking,
      }),
      [hook.ready],
    );

    const w = width ?? size;
    const h = height ?? size;

    return createElement('canvas', {
      ref: hook.canvasRef,
      className,
      'aria-label': ariaLabel,
      style: {
        display: 'block',
        width: typeof w === 'number' ? `${w}px` : w,
        height: typeof h === 'number' ? `${h}px` : h,
        touchAction: 'none',
        ...style,
      },
    });
  });

  return {
    QuestieMascot,
    useQuestieMascot,
    BEHAVIOR_STATES,
    BEHAVIOR_BY_ID,
    behaviorForEmotion,
  };
}
