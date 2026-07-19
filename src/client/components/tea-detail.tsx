import type { Tea } from "@shared/types";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdBrewPanel } from "@/components/cold-brew-panel";
import { getColdBrew } from "@shared/cold-brew";
import { useUnits } from "@/hooks/use-units";
import {
  urgencyConfig,
  getCategoryGradient,
  getCountryFlag,
  formatBrewingTemp,
  formatBrewingTime,
  caffeineLabel,
} from "@/lib/tea-utils";
import { Thermometer, Clock, Scale, Coffee, Droplets } from "lucide-react";

interface TeaDetailProps {
  tea: Tea | null;
  open: boolean;
  onClose: () => void;
}

type BrewMode = "traditional" | "hot" | "cold-brew";

/**
 * Every tea's hot schedule is a rounds array, but the tradition it belongs to
 * differs — and the vessel is what names it. A kyusu schedule is senchadō, not
 * gongfu; only the Chinese gaiwan teas are actually brewed gongfu style.
 */
const VESSEL_LABELS: Record<string, string> = {
  gaiwan: "Gongfu",
  kyusu: "Japanese",
  shiboridashi: "Japanese",
  chawan: "Whisked",
  "matcha bowl": "Whisked",
  "çaydanlık": "Turkish",
};

function hotModeLabel(tea: Tea): string {
  if (tea.category.startsWith("matcha")) return "Whisked";

  const byVessel = VESSEL_LABELS[tea.brewing?.vessel?.toLowerCase() ?? ""];
  if (byVessel) return byVessel;

  // Generic vessel ("teapot", "any"). A multi-round schedule still belongs to a
  // tradition — gongfu is regularly done in a yixing pot rather than a gaiwan —
  // so fall back to origin. Single infusions are Western whatever the origin.
  if ((tea.brewing?.rounds.length ?? 0) > 1) {
    if (tea.origin.country === "China") return "Gongfu";
    if (tea.origin.country === "Japan") return "Japanese";
  }
  return "Western";
}

function modeLabel(mode: BrewMode, tea: Tea): string {
  if (mode === "cold-brew") return "Cold Brew";
  // The 8 teas carrying a `simple` block are all gaiwan teas, so its counterpart
  // is always the Western single infusion.
  if (mode === "traditional") return "Western";
  return hotModeLabel(tea);
}

/** Which brewing modes this tea actually supports, in display order. */
function availableModes(tea: Tea | null): BrewMode[] {
  if (!tea) return [];
  const modes: BrewMode[] = [];
  if (tea.brewing?.simple) modes.push("traditional");
  if (tea.brewing?.rounds.length) modes.push("hot");
  if (getColdBrew(tea)) modes.push("cold-brew");
  return modes;
}

export function TeaDetail({ tea, open, onClose }: TeaDetailProps) {
  const { units } = useUnits();
  const modes = availableModes(tea);
  const [mode, setMode] = useState<BrewMode | null>(modes[0] ?? null);

  useEffect(() => { setMode(availableModes(tea)[0] ?? null); }, [tea?.id]);

  if (!tea) return null;

  const urgency = urgencyConfig[tea.urgency];
  const gradient = getCategoryGradient(tea.category);
  const coldBrew = getColdBrew(tea);
  const activeMode = mode && modes.includes(mode) ? mode : modes[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[100vw] sm:max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto p-0 rounded-none sm:rounded-xl h-[100dvh] sm:h-auto">
        {/* Header with gradient */}
        <div className={`relative h-48 bg-gradient-to-br ${gradient} flex items-end p-6`}>
          <div className="absolute inset-0 bg-black/15" />
          <DialogHeader className="relative z-10 space-y-1">
            <DialogTitle className="text-white text-2xl font-semibold drop-shadow-sm">
              {tea.name.primary}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              {tea.name.alternate && (
                <span className="mr-3">{tea.name.alternate}</span>
              )}
              {tea.name.pronunciation && (
                <span className="italic">({tea.name.pronunciation})</span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{tea.category_label}</Badge>
            <Badge variant="outline" className={urgency.color}>
              {urgency.label}
            </Badge>
            <Badge variant="outline">
              {caffeineLabel(tea.caffeine_level)}
            </Badge>
            <Badge variant="outline">
              {getCountryFlag(tea.origin.country)} {tea.origin.region}, {tea.origin.country}
            </Badge>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Notes</h4>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {tea.notes.trim()}
            </p>
          </div>

          {/* Producer */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Producer</h4>
            <p className="text-sm font-medium">{tea.producer.name}</p>
            {tea.producer.history && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {tea.producer.history}
              </p>
            )}
          </div>

          <Separator />

          {/* Brewing */}
          {(tea.brewing || coldBrew) && (
            <div>
              <div className="flex items-center justify-between mb-3 gap-3">
                <h4 className="text-sm font-medium text-foreground">Brewing</h4>
                {modes.length > 1 && activeMode && (
                  <Tabs value={activeMode} onValueChange={(v) => setMode(v as BrewMode)}>
                    <TabsList>
                      {modes.map((m) => (
                        <TabsTrigger key={m} value={m} className="px-2.5 text-xs">
                          {modeLabel(m, tea)}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
              </div>

              {/* Vessel & leaf ratio — hot brewing only */}
              {activeMode === "hot" && tea.brewing && (
                <div className="flex flex-wrap gap-4 mb-3">
                  {tea.brewing.leaf_grams_per_100ml && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Scale className="w-3.5 h-3.5" />
                      <span>{tea.brewing.leaf_grams_per_100ml}g / 100ml</span>
                    </div>
                  )}
                  {tea.brewing.vessel && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Coffee className="w-3.5 h-3.5" />
                      <span>{tea.brewing.vessel}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Traditional — single infusion */}
              {activeMode === "traditional" && tea.brewing?.simple && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                    {tea.brewing.simple.leaf_grams}g
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatBrewingTemp(tea.brewing.simple.water_temp_c, units)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatBrewingTime(tea.brewing.simple.steep_time_seconds)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
                    {tea.brewing.simple.water_ml}ml
                  </span>
                </div>
              )}

              {/* Hot — one row per round, collapsed to a single line when there's only one */}
              {activeMode === "hot" && tea.brewing && (
                tea.brewing.rounds.length === 1 ? (
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatBrewingTemp(tea.brewing.rounds[0].water_temp_c, units)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatBrewingTime(tea.brewing.rounds[0].steep_time_seconds)}
                    </span>
                    {tea.brewing.rounds[0].water_ml && (
                      <span className="flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
                        {tea.brewing.rounds[0].water_ml}ml
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tea.brewing.rounds.map((round, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-4 text-xs text-muted-foreground font-medium">{i + 1}.</span>
                        <span>{formatBrewingTemp(round.water_temp_c, units)}</span>
                        <span className="text-muted-foreground">·</span>
                        <span>{formatBrewingTime(round.steep_time_seconds)}</span>
                        {round.water_ml && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span>{round.water_ml}ml</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeMode === "cold-brew" && coldBrew && <ColdBrewPanel rule={coldBrew} />}

              {/* Authored notes describe hot brewing — the cold brew panel carries its own. */}
              {tea.brewing?.notes && activeMode !== "cold-brew" && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                  {tea.brewing.notes}
                </p>
              )}
            </div>
          )}

          <Separator />

          {/* Acquisition & meta */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {tea.acquisition.location && (
              <div>
                <span className="text-muted-foreground">Acquired in</span>
                <p className="font-medium">
                  {tea.acquisition.location}
                  {tea.acquisition.context && (
                    <span className="text-muted-foreground font-normal"> — {tea.acquisition.context}</span>
                  )}
                </p>
              </div>
            )}
            {tea.expiry_estimate && (
              <div>
                <span className="text-muted-foreground">Best before</span>
                <p className="font-medium">{tea.expiry_estimate}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {tea.tags && tea.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tea.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Photo attribution */}
          {tea.photo?.source && (
            <p className="text-xs text-muted-foreground/60">
              Photo: {tea.photo.source}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
