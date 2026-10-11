import { describe, expect, test } from "bun:test";
import { hexToHSV, hsvToHex, normalizeHex } from "@/shared/ui/color-utils";

describe("custom colors", () => {
  test("accepts short and full hex codes and rejects incomplete or invalid values", () => {
    expect(normalizeHex(" #ABC ")).toBe("#aabbcc");
    expect(normalizeHex("8BBCFF")).toBe("#8bbcff");
    for (const value of ["", "#12", "#12345", "#gggggg", "red", "#12345678"]) {
      expect(normalizeHex(value)).toBeNull();
    }
  });
  test("preserves colors when switching between hex and the spectrum", () => {
    for (const color of [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#000000",
      "#ffffff",
      "#777777",
      "#8bbcff",
      "#334455",
    ]) {
      expect(hsvToHex(hexToHSV(color))).toBe(color);
    }
  });
});
