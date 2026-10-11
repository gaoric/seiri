export type HSV = { hue: number; saturation: number; value: number };

export function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) {
    return `#${[...hex].map((digit) => digit + digit).join("")}`.toLowerCase();
  }
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}

export function hexToHSV(hex: string): HSV {
  const [red, green, blue] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const maximum = Math.max(red!, green!, blue!);
  const minimum = Math.min(red!, green!, blue!);
  const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === red) hue = (green! - blue!) / delta;
    else if (maximum === green) hue = (blue! - red!) / delta + 2;
    else hue = (red! - green!) / delta + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: maximum ? delta / maximum : 0,
    value: maximum,
  };
}

export function hsvToHex({ hue, saturation, value }: HSV) {
  const chroma = value * saturation;
  const sector = (hue / 60) % 6;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const channels = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(sector)]!;
  return `#${channels
    .map((channel) =>
      Math.round((channel + value - chroma) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
