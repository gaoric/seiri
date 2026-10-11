import { Popover } from "@base-ui/react/popover";
import { Check, Pipette, SlidersHorizontal } from "lucide-react";
import { useState, type CSSProperties, type PointerEvent } from "react";
import { hexToHSV, hsvToHex, normalizeHex, type HSV } from "./color-utils";
import "./color-picker.css";

type ColorOption = { label: string; value: string };
type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> };

export function ColorPicker({
  value,
  options,
  onChange,
  onReset,
  allowCustom = true,
  hexLabel = "Color hex code",
}: {
  value: string;
  options: readonly ColorOption[];
  onChange: (color: string) => void;
  onReset?: () => void;
  allowCustom?: boolean;
  hexLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <fieldset className="item-color-picker">
      <legend>Color</legend>
      <div
        className="item-color-swatches"
        style={{ gridTemplateColumns: `repeat(${options.length + (allowCustom ? 1 : 0)}, 1fr)` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label} color`}
            aria-pressed={value.toLowerCase() === option.value.toLowerCase()}
            title={option.label}
            style={{ "--swatch-color": option.value } as CSSProperties}
            onClick={() => onChange(option.value)}
          >
            {value.toLowerCase() === option.value.toLowerCase() && <Check />}
          </button>
        ))}
        {allowCustom && (
          <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger
              className="item-custom-color"
              type="button"
              aria-label="Custom color"
              title="Custom color"
            >
              <SlidersHorizontal />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner className="item-color-positioner" sideOffset={8} align="end">
                <Popover.Popup className="item-color-panel" aria-label="Custom color picker">
                  <CustomColorPanel
                    key={open ? "open" : "closed"}
                    value={value}
                    hexLabel={hexLabel}
                    onApply={(color) => {
                      onChange(color);
                      setOpen(false);
                    }}
                  />
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
      {onReset && (
        <button className="item-color-reset" type="button" onClick={onReset}>
          Use default color
        </button>
      )}
    </fieldset>
  );
}

function CustomColorPanel({
  value,
  hexLabel,
  onApply,
}: {
  value: string;
  hexLabel: string;
  onApply: (color: string) => void;
}) {
  const [hsv, setHSV] = useState(() => hexToHSV(value));
  const [hex, setHex] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;

  function update(next: HSV) {
    setHSV(next);
    setHex(hsvToHex(next));
    setError(null);
  }
  function selectPosition(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    update({
      ...hsv,
      saturation: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      value: Math.max(0, Math.min(1, 1 - (event.clientY - box.top) / box.height)),
    });
  }
  async function sampleColor() {
    if (!EyeDropper) return;
    try {
      const result = await new EyeDropper().open();
      update(hexToHSV(result.sRGBHex));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setError("Could not sample that color. Try again or enter a hex code.");
      }
    }
  }
  return (
    <div>
      <div className="item-color-panel-heading">
        <strong>Custom color</strong>
        <button
          type="button"
          aria-label="Pick color from screen"
          disabled={!EyeDropper}
          onClick={sampleColor}
          title={
            EyeDropper ? "Pick color from screen" : "Screen sampling is unavailable in this browser"
          }
        >
          <Pipette />
        </button>
      </div>
      <div
        className="item-color-spectrum"
        role="slider"
        tabIndex={0}
        aria-label="Color saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.saturation * 100)}
        aria-valuetext={`${Math.round(hsv.saturation * 100)}% saturation, ${Math.round(hsv.value * 100)}% brightness`}
        style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          selectPosition(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) selectPosition(event);
        }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          update({
            ...hsv,
            saturation: Math.max(
              0,
              Math.min(
                1,
                hsv.saturation +
                  (event.key === "ArrowRight" ? 0.01 : event.key === "ArrowLeft" ? -0.01 : 0),
              ),
            ),
            value: Math.max(
              0,
              Math.min(
                1,
                hsv.value +
                  (event.key === "ArrowUp" ? 0.01 : event.key === "ArrowDown" ? -0.01 : 0),
              ),
            ),
          });
        }}
      >
        <i style={{ left: `${hsv.saturation * 100}%`, top: `${(1 - hsv.value) * 100}%` }} />
      </div>
      <input
        className="item-color-hue"
        type="range"
        aria-label="Color hue"
        min={0}
        max={359}
        value={hsv.hue}
        onChange={(event) => update({ ...hsv, hue: Number(event.target.value) })}
      />
      <label className="item-color-hex">
        <span style={{ background: hsvToHex(hsv) }} />
        <input
          aria-label={hexLabel}
          value={hex}
          maxLength={7}
          spellCheck={false}
          aria-invalid={!normalizeHex(hex)}
          onChange={(event) => {
            setHex(event.target.value);
            const normalized = normalizeHex(event.target.value);
            if (normalized) setHSV(hexToHSV(normalized));
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="item-color-apply"
        type="button"
        disabled={!normalizeHex(hex)}
        onClick={() => onApply(normalizeHex(hex)!)}
      >
        Apply color
      </button>
    </div>
  );
}
