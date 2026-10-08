import bellDelayUrl from "./audio/bell-sound-with-delay.mp3";
import fluteNotificationUrl from "./audio/04-flute-notification.mp3";
import forestBirdsUrl from "./audio/01-forest-birds.mp3";
import happyBellsUrl from "./audio/04-happy-bells.mp3";
import magicMarimbaUrl from "./audio/02-magic-marimba.mp3";
import type { SoundAsset } from "@/shared/sound/sound-types";

function mixkitSound(name: string, dataUri: string, duration: number): SoundAsset {
  return {
    name,
    dataUri,
    duration,
    format: "mp3",
    license: "Mixkit",
    author: "Mixkit",
  };
}

export const fluteNotificationSound = mixkitSound(
  "04-flute-notification",
  fluteNotificationUrl,
  3,
);

export const forestBirdsSound = mixkitSound(
  "01-forest-birds",
  forestBirdsUrl,
  3,
);

export const happyBellsSound = mixkitSound(
  "04-happy-bells",
  happyBellsUrl,
  3,
);

export const magicMarimbaSound = mixkitSound(
  "02-magic-marimba",
  magicMarimbaUrl,
  3,
);

export const bellDelaySound = mixkitSound(
  "Bell sound with delay",
  bellDelayUrl,
  3,
);
