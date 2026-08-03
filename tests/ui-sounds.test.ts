import { describe, expect, test } from "bun:test";
import {
  getClickSound,
  MASTER_SOUND_VOLUME,
  requestUiSound,
  SOUND_PLAYBACK_OPTIONS,
  SOUND_SEQUENCE_BUFFER_MS,
  UI_SOUND_EVENT,
} from "@/hooks/use-ui-sounds";

describe("UI sound routing", () => {
  test("keeps the shared SoundCN volume low", () => {
    expect(MASTER_SOUND_VOLUME).toBe(0.08);
    expect(SOUND_PLAYBACK_OPTIONS.skipIfPlaying).toBe(true);
    expect(SOUND_PLAYBACK_OPTIONS.cooldownMs).toBe(100);
    expect(SOUND_SEQUENCE_BUFFER_MS).toBe(100);
    expect("interrupt" in SOUND_PLAYBACK_OPTIONS).toBe(false);
  });

  test("uses control state to distinguish opening and closing clicks", () => {
    const button = document.createElement("button");
    button.setAttribute("aria-expanded", "false");
    expect(getClickSound(button)).toBe("open");

    button.setAttribute("aria-expanded", "true");
    expect(getClickSound(button)).toBe("close");

    button.dataset.uiSound = "custom";
    expect(getClickSound(button)).toBe("custom");
  });

  test("routes non-button interactions through the shared sound event", () => {
    let requestedSound: string | undefined;
    document.addEventListener(
      UI_SOUND_EVENT,
      ((event: CustomEvent<string>) => {
        requestedSound = event.detail;
      }) as EventListener,
      { once: true },
    );

    requestUiSound("close");
    expect(requestedSound).toBe("close");
  });
});
