"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioContext, decodeAudioData } from "@/shared/sound/sound-engine";
import type {
  SoundAsset,
  UseSoundOptions,
  UseSoundReturn,
} from "@/shared/sound/sound-types";

export function useSound(
  sound: SoundAsset,
  options: UseSoundOptions = {}
): UseSoundReturn {
  const {
    volume = 1,
    playbackRate = 1,
    interrupt = false,
    skipIfPlaying = false,
    cooldownMs = 0,
    soundEnabled = true,
    stopOnUnmount = true,
    onPlay,
    onEnd,
    onPause,
    onStop,
  } = options;

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(
    sound.duration ?? null
  );
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const cooldownUntilRef = useRef(0);
  const stopOnUnmountRef = useRef(stopOnUnmount);

  useEffect(() => {
    stopOnUnmountRef.current = stopOnUnmount;
  });

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;

    let cancelled = false;
    decodeAudioData(sound.dataUri).then((buffer) => {
      if (!cancelled) {
        bufferRef.current = buffer;
        setDuration(buffer.duration);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sound.dataUri]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
    onStop?.();
  }, [onStop]);

  useEffect(() => {
    if (!soundEnabled) stop();
  }, [soundEnabled, stop]);

  const play = useCallback(
    (overrides?: { volume?: number; playbackRate?: number }) => {
      if (
        !soundEnabled ||
        !bufferRef.current ||
        typeof AudioContext === "undefined"
      ) {
        return;
      }

      if (
        (skipIfPlaying && sourceRef.current) ||
        Date.now() < cooldownUntilRef.current
      ) {
        return;
      }

      const ctx = getAudioContext();

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (interrupt && sourceRef.current) {
        stop();
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = bufferRef.current;
      source.playbackRate.value = overrides?.playbackRate ?? playbackRate;
      gain.gain.value = overrides?.volume ?? volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null;
        }
        cooldownUntilRef.current = Date.now() + cooldownMs;
        setIsPlaying(false);
        onEnd?.();
      };

      source.start(0);
      sourceRef.current = source;
      gainRef.current = gain;
      setIsPlaying(true);
      onPlay?.();
    },
    [
      soundEnabled,
      playbackRate,
      volume,
      interrupt,
      skipIfPlaying,
      cooldownMs,
      stop,
      onPlay,
      onEnd,
    ]
  );

  const pause = useCallback(() => {
    stop();
    onPause?.();
  }, [stop, onPause]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (stopOnUnmountRef.current && sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // Already stopped
        }
      }
      sourceRef.current = null;
    };
  }, []);

  return [play, { stop, pause, isPlaying, duration, sound }] as const;
}
