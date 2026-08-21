import { useCallback, useEffect, useState } from "react";
import { click002Sound } from "@/shared/sound/assets/click-002";
import { click003Sound } from "@/shared/sound/assets/click-003";
import { confirmation002Sound } from "@/shared/sound/assets/confirmation-002";
import { drop001Sound } from "@/shared/sound/assets/drop-001";
import { forceField000Sound } from "@/shared/sound/assets/force-field-000";
import { forceField001Sound } from "@/shared/sound/assets/force-field-001";
import { laserLarge002Sound } from "@/shared/sound/assets/laser-large-002";
import { useSound } from "@/shared/sound/use-sound";

export const MASTER_SOUND_VOLUME = 0.08;
export const SOUND_SEQUENCE_BUFFER_MS = 100;
export const SOUND_ENABLED_STORAGE_KEY = "seiri.sounds.enabled";
export const UI_SOUND_EVENT = "seiri:ui-sound";
export const SOUND_PLAYBACK_OPTIONS = {
  volume: MASTER_SOUND_VOLUME,
  skipIfPlaying: true,
  cooldownMs: SOUND_SEQUENCE_BUFFER_MS,
} as const;

const INTERACTIVE_SELECTOR = [
  "button:not(:disabled)",
  '[role="button"]:not([aria-disabled="true"])',
  '[role="option"]:not([aria-disabled="true"])',
].join(",");

type ClickSound = "open" | "close" | "custom";
export type UiSoundCue = Exclude<ClickSound, "custom">;

export function requestUiSound(cue: UiSoundCue) {
  document.dispatchEvent(
    new CustomEvent<UiSoundCue>(UI_SOUND_EVENT, { detail: cue }),
  );
}

function findInteractive(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>(INTERACTIVE_SELECTOR)
    : null;
}

export function getClickSound(element: HTMLElement): ClickSound {
  const explicitSound = element.dataset.uiSound as ClickSound | undefined;
  if (explicitSound) return explicitSound;

  const isCurrentlyOpen =
    element.getAttribute("aria-expanded") === "true" ||
    element.getAttribute("aria-pressed") === "true" ||
    element.hasAttribute("data-popup-open");

  return isCurrentlyOpen ? "close" : "open";
}

/**
 * Preloads SoundCN effects, provides animation cues, and delegates the common
 * click feedback so portaled controls receive the same sound treatment.
 */
export function useUiSounds() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== "false";
  });
  const playbackOptions = { ...SOUND_PLAYBACK_OPTIONS, soundEnabled };
  const [playOpen] = useSound(click003Sound, playbackOptions);
  const [playClose] = useSound(click002Sound, playbackOptions);
  const [playHologramOn] = useSound(
    forceField000Sound,
    playbackOptions,
  );
  const [playHologramOff] = useSound(
    forceField001Sound,
    playbackOptions,
  );
  const [playVhsShutdown] = useSound(
    laserLarge002Sound,
    playbackOptions,
  );
  const [playConfirmation] = useSound(
    confirmation002Sound,
    playbackOptions,
  );
  const [playNewTaskDrop] = useSound(
    drop001Sound,
    playbackOptions,
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, `${next}`);
      return next;
    });
  }, []);

  useEffect(() => {
    const pendingClickSounds = new WeakMap<HTMLElement, ClickSound>();

    function handlePointerDown(event: PointerEvent) {
      const interactive = findInteractive(event.target);
      if (interactive) {
        pendingClickSounds.set(interactive, getClickSound(interactive));
      }
    }

    function handleClick(event: MouseEvent) {
      const interactive = findInteractive(event.target);
      if (!interactive) return;

      const sound =
        pendingClickSounds.get(interactive) ?? getClickSound(interactive);
      pendingClickSounds.delete(interactive);
      if (sound === "open") playOpen();
      if (sound === "close") playClose();
    }

    function handleRequestedSound(event: Event) {
      const cue = (event as CustomEvent<UiSoundCue>).detail;
      if (cue === "open") playOpen();
      if (cue === "close") playClose();
    }

    // Base UI may toggle on pointer-down, so remember the state before it runs.
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener(UI_SOUND_EVENT, handleRequestedSound);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener(UI_SOUND_EVENT, handleRequestedSound);
    };
  }, [playClose, playOpen]);

  return {
    playConfirmation,
    playHologramOff,
    playHologramOn,
    playNewTaskDrop,
    playVhsShutdown,
    soundEnabled,
    toggleSound,
  };
}

export type UiSounds = ReturnType<typeof useUiSounds>;
