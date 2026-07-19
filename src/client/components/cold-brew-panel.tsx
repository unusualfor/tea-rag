import { useState } from "react";
import { Clock, Moon, Scale, Snowflake } from "lucide-react";
import type { ColdBrewRule } from "@shared/cold-brew";
import { COLD_BREW_TEMP_C, coldBrewGrams } from "@shared/cold-brew";
import { useUnits } from "@/hooks/use-units";
import {
  flOzToMl,
  formatBrewingTemp,
  formatMass,
  formatSteepHours,
  mlToFlOz,
} from "@/lib/tea-utils";
import { cn } from "@/lib/utils";

const PRESETS_ML = [600, 750, 1000];
const OVERNIGHT_HOURS: [number, number] = [8, 12];

interface ColdBrewPanelProps {
  rule: ColdBrewRule;
}

export function ColdBrewPanel({ rule }: ColdBrewPanelProps) {
  const { units, toggle } = useUnits();
  const [waterMl, setWaterMl] = useState(1000);

  const imperial = units === "imperial";
  const grams = coldBrewGrams(rule.g_per_l, waterMl);
  // The input shows whichever unit is active, but waterMl stays the source of truth.
  const displayVolume = imperial ? mlToFlOz(waterMl) : waterMl;

  function handleVolumeChange(raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setWaterMl(imperial ? flOzToMl(parsed) : Math.round(parsed));
  }

  return (
    <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-sky-900 dark:text-sky-100">
          <Snowflake className="h-3.5 w-3.5" />
          Cold Brew
        </span>
        <button
          type="button"
          onClick={toggle}
          className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 transition-colors hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:hover:bg-sky-900/60"
        >
          {imperial ? "fl oz" : "ml"}
        </button>
      </div>

      {/* Dose — scales live with the chosen volume */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Scale className="h-3.5 w-3.5 text-muted-foreground" />
          {formatMass(grams)}
        </span>
        <span className="text-muted-foreground">in</span>
        <input
          type="number"
          min={1}
          value={displayVolume}
          onChange={(e) => handleVolumeChange(e.target.value)}
          aria-label={imperial ? "Water volume in fluid ounces" : "Water volume in millilitres"}
          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-muted-foreground">{imperial ? "fl oz" : "ml"}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS_ML.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setWaterMl(preset)}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs transition-colors",
              waterMl === preset
                ? "bg-sky-600 text-white dark:bg-sky-500"
                : "bg-sky-100/70 text-sky-800 hover:bg-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
            )}
          >
            {imperial ? `${mlToFlOz(preset)} fl oz` : preset === 1000 ? "1 L" : `${preset} ml`}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <Snowflake className="h-3.5 w-3.5 text-muted-foreground" />
          fridge ({formatBrewingTemp(COLD_BREW_TEMP_C, units)})
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {formatSteepHours(rule.hours)}
        </span>
      </div>

      <OvernightBlock rule={rule} waterMl={waterMl} />

      {rule.note && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{rule.note}</p>
      )}
    </div>
  );
}

function OvernightBlock({ rule, waterMl }: { rule: ColdBrewRule; waterMl: number }) {
  const { overnight } = rule;

  return (
    <div className="mt-4 rounded-md bg-indigo-50/70 p-3 dark:bg-indigo-950/30">
      <span className="flex items-center gap-1.5 text-sm font-medium text-indigo-900 dark:text-indigo-100">
        <Moon className="h-3.5 w-3.5" />
        Overnight
        {overnight.kind !== "avoid" && (
          <span className="font-normal text-muted-foreground">
            ({formatSteepHours(OVERNIGHT_HOURS)})
          </span>
        )}
      </span>

      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {overnight.kind === "ok" && (
          <>
            Same leaf. Fuller body and a little more caffeine — not bitter, since cold water
            barely pulls catechins.
          </>
        )}
        {overnight.kind === "reduce" && (
          <>
            Use{" "}
            <span className="font-medium text-foreground">
              {formatMass(coldBrewGrams(overnight.g_per_l, waterMl))}
            </span>{" "}
            instead. Broken leaf keeps extracting overnight and turns muddy at the full dose.
          </>
        )}
        {overnight.kind === "avoid" && <>Not recommended. {overnight.reason}</>}
      </p>
    </div>
  );
}
