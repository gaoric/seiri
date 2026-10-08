let audioContext: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export async function decodeAudioData(source: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(source);
  if (cached) return cached;

  const ctx = getAudioContext();
  let bytes: ArrayBuffer;

  if (source.startsWith("data:")) {
    const base64 = source.split(",")[1];
    const binaryString = atob(base64);
    const decoded = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      decoded[i] = binaryString.charCodeAt(i);
    }
    bytes = decoded.buffer.slice(0);
  } else {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load sound asset: ${response.status}`);
    }
    bytes = await response.arrayBuffer();
  }

  const audioBuffer = await ctx.decodeAudioData(bytes);
  bufferCache.set(source, audioBuffer);
  return audioBuffer;
}

export interface PlaySoundOptions {
  volume?: number;
  playbackRate?: number;
  onEnd?: () => void;
}

export interface SoundPlayback {
  stop: () => void;
}

export async function playSound(
  dataUri: string,
  options: PlaySoundOptions = {}
): Promise<SoundPlayback> {
  const { volume = 1, playbackRate = 1, onEnd } = options;
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const buffer = await decodeAudioData(dataUri);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();

  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(ctx.destination);

  source.onended = () => {
    onEnd?.();
  };

  source.start(0);

  return {
    stop: () => {
      try {
        source.stop();
      } catch {
        // No-op if already stopped.
      }
    },
  };
}
