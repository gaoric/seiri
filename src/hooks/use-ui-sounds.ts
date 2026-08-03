import { useCallback, useEffect, useState } from "react";
import { useSound } from "@/hooks/use-sound";
import { click002Sound } from "@/sounds/click-002";
import { click003Sound } from "@/sounds/click-003";
import { click005Sound } from "@/sounds/click-005";
import { confirmation002Sound } from "@/sounds/confirmation-002";
import { drop001Sound } from "@/sounds/drop-001";
import { forceField000Sound } from "@/sounds/force-field-000";
import { forceField001Sound } from "@/sounds/force-field-001";
import { laserLarge002Sound } from "@/sounds/laser-large-002";

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
const HOVER_SELECTOR = `${INTERACTIVE_SELECTOR},[data-ui-hover-sound]`;

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

function findHoverTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLElement>(HOVER_SELECTOR)
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
 * hover/click feedback so portaled controls receive the same sound treatment.
 */
export function useUiSounds() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== "false";
  });
  const playbackOptions = { ...SOUND_PLAYBACK_OPTIONS, soundEnabled };
  const [playHover] = useSound(click005Sound, {
    ...playbackOptions,
    volume: MASTER_SOUND_VOLUME * 0.5,
  });
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

    function handlePointerOver(event: PointerEvent) {
      const hoverTarget = findHoverTarget(event.target);
      if (!hoverTarget) return;

      const previous = event.relatedTarget;
      if (previous instanceof Node && hoverTarget.contains(previous)) return;
      playHover();
    }

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

    document.addEventListener("pointerover", handlePointerOver);
    // Base UI may toggle on pointer-down, so remember the state before it runs.
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener(UI_SOUND_EVENT, handleRequestedSound);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener(UI_SOUND_EVENT, handleRequestedSound);
    };
  }, [playClose, playHover, playOpen]);

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
