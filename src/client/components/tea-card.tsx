import type { Tea } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  urgencyConfig,
  getCategoryGradient,
  getCountryFlag,
} from "@/lib/tea-utils";

interface TeaCardProps {
  tea: Tea;
  onClick: (tea: Tea) => void;
}

export function TeaCard({ tea, onClick }: TeaCardProps) {
  const urgency = urgencyConfig[tea.urgency];
  const gradient = getCategoryGradient(tea.category);

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
      onClick={() => onClick(tea)}
    >
      {/* Photo or placeholder */}
      <div className={`relative h-40 bg-gradient-to-br ${gradient} flex items-end p-4`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <h3 className="text-white font-semibold text-lg leading-tight drop-shadow-sm">
            {tea.name.primary}
          </h3>
          {tea.name.alternate && (
            <p className="text-white/80 text-sm mt-0.5 drop-shadow-sm">
              {tea.name.alternate}
            </p>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs font-medium shrink-0">
            {tea.category_label}
          </Badge>
          <span className="text-sm text-muted-foreground truncate text-right">
            {getCountryFlag(tea.origin.country)} {tea.origin.region}
          </span>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {tea.notes.split("\n")[0]}
        </p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${urgency.dotColor}`} />
            <span className="text-xs text-muted-foreground">{urgency.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {tea.producer.name}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
