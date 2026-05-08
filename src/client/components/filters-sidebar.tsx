import type { TeaCategory, TeaUrgency, TeaStatus } from "@shared/types";
import type { Filters } from "@/hooks/use-teas";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { urgencyConfig, statusLabels } from "@/lib/tea-utils";
import { X } from "lucide-react";

interface FiltersSidebarProps {
  filters: Filters;
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  categories: TeaCategory[];
  categoryLabels: Record<string, string>;
  countries: string[];
  urgencies: TeaUrgency[];
  statuses: TeaStatus[];
}

export function FiltersSidebar({
  filters,
  onFilterChange,
  onClear,
  hasActiveFilters,
  categories,
  categoryLabels,
  countries,
  urgencies,
  statuses,
}: FiltersSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Filters
        </h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Urgency */}
      <div>
        <h3 className="text-sm font-medium mb-2">Urgency</h3>
        <p className="text-xs text-muted-foreground/70 italic mb-3">
          It's a journey, not a race.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {urgencies.map((u) => (
            <FilterChip
              key={u}
              label={urgencyConfig[u].label}
              active={filters.urgency === u}
              onClick={() =>
                onFilterChange("urgency", filters.urgency === u ? null : u)
              }
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Category */}
      <div>
        <h3 className="text-sm font-medium mb-2">Category</h3>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <FilterChip
              key={cat}
              label={categoryLabels[cat] || cat}
              active={filters.category === cat}
              onClick={() =>
                onFilterChange("category", filters.category === cat ? null : cat)
              }
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Country */}
      <div>
        <h3 className="text-sm font-medium mb-2">Country</h3>
        <div className="flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={filters.country === c}
              onClick={() =>
                onFilterChange("country", filters.country === c ? null : c)
              }
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Status */}
      <div>
        <h3 className="text-sm font-medium mb-2">Status</h3>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <FilterChip
              key={s}
              label={statusLabels[s]}
              active={filters.status === s}
              onClick={() =>
                onFilterChange("status", filters.status === s ? null : s)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className="cursor-pointer transition-colors hover:bg-primary/10 select-none"
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}
