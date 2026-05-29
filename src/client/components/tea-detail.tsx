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

export function TeaDetail({ tea, open, onClose }: TeaDetailProps) {
  const [showGongfu, setShowGongfu] = useState(false);

  useEffect(() => { setShowGongfu(false); }, [tea?.id]);

  if (!tea) return null;

  const urgency = urgencyConfig[tea.urgency];
  const gradient = getCategoryGradient(tea.category);

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
          {tea.brewing && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground">Brewing</h4>
                {tea.brewing.simple && (
                  <button
                    type="button"
                    onClick={() => setShowGongfu(!showGongfu)}
                    className={`
                      relative inline-flex h-6 items-center gap-1.5 rounded-full px-2.5
                      text-xs font-medium transition-colors
                      ${showGongfu
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }
                    `}
                  >
                    {showGongfu ? "Gongfu" : "Traditional"}
                  </button>
                )}
              </div>

              {/* Vessel & leaf ratio — only for gongfu mode or teas without simple */}
              {(!tea.brewing.simple || showGongfu) && (
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

              {/* Simple (traditional) view — single infusion */}
              {tea.brewing.simple && !showGongfu ? (
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatBrewingTemp(tea.brewing.simple.water_temp_c)}
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
              ) : tea.brewing.rounds.length === 1 ? (
                /* Single round — no toggle needed */
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatBrewingTemp(tea.brewing.rounds[0].water_temp_c)}
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
                /* Multi-round (gongfu or Japanese) */
                <div className="space-y-1">
                  {tea.brewing.rounds.map((round, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-xs text-muted-foreground font-medium">{i + 1}.</span>
                      <span>{formatBrewingTemp(round.water_temp_c)}</span>
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
              )}

              {tea.brewing.notes && (
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
