import type { Tea } from "@shared/types";
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
  statusLabels,
  getCategoryGradient,
  getCountryFlag,
  formatBrewingTemp,
  formatBrewingTime,
} from "@/lib/tea-utils";
import { Thermometer, Clock, Scale, Coffee, RotateCcw } from "lucide-react";

interface TeaDetailProps {
  tea: Tea | null;
  open: boolean;
  onClose: () => void;
}

export function TeaDetail({ tea, open, onClose }: TeaDetailProps) {
  if (!tea) return null;

  const urgency = urgencyConfig[tea.urgency];
  const gradient = getCategoryGradient(tea.category);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
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
            <Badge variant="outline">{statusLabels[tea.status]}</Badge>
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
              <h4 className="text-sm font-medium text-foreground mb-3">Brewing</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <BrewingParam
                  icon={<Thermometer className="w-4 h-4" />}
                  label="Temperature"
                  value={formatBrewingTemp(tea.brewing.water_temp_c)}
                />
                <BrewingParam
                  icon={<Clock className="w-4 h-4" />}
                  label="Steep time"
                  value={formatBrewingTime(tea.brewing.steep_time_seconds)}
                />
                {tea.brewing.leaf_grams_per_100ml && (
                  <BrewingParam
                    icon={<Scale className="w-4 h-4" />}
                    label="Leaf ratio"
                    value={`${tea.brewing.leaf_grams_per_100ml}g / 100ml`}
                  />
                )}
                {tea.brewing.vessel && (
                  <BrewingParam
                    icon={<Coffee className="w-4 h-4" />}
                    label="Vessel"
                    value={tea.brewing.vessel}
                  />
                )}
                {tea.brewing.rounds && (
                  <BrewingParam
                    icon={<RotateCcw className="w-4 h-4" />}
                    label="Rounds"
                    value={`${tea.brewing.rounds}`}
                  />
                )}
              </div>
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

function BrewingParam({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
