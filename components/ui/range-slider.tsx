import { cn } from "@/lib/utils";

export function RangeSlider({
  min,
  max,
  step = 0.01,
  value,
  onChange,
  disabled
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  disabled?: boolean;
}) {
  const [low, high] = value;

  return (
    <div className={cn("space-y-2", disabled && "opacity-60")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{low.toFixed(2)}</span>
        <span>{high.toFixed(2)}</span>
      </div>
      <div className="relative h-8">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-secondary" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-primary"
          style={{
            left: `${((low - min) / Math.max(max - min, 0.0001)) * 100}%`,
            width: `${((high - low) / Math.max(max - min, 0.0001)) * 100}%`
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          disabled={disabled}
          onChange={(e) => {
            const nextLow = Math.min(Number(e.target.value), high);
            onChange([nextLow, high]);
          }}
          className="pointer-events-auto absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          disabled={disabled}
          onChange={(e) => {
            const nextHigh = Math.max(Number(e.target.value), low);
            onChange([low, nextHigh]);
          }}
          className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        />
      </div>
    </div>
  );
}
