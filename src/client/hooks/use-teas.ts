import { useState, useEffect, useCallback } from "react";
import type { Tea, TeaCategory, TeaUrgency } from "@shared/types";
import teasData from "../../data/teas.json";

export interface Filters {
  category: TeaCategory | null;
  urgency: TeaUrgency | null;
  country: string | null;
}

const emptyFilters: Filters = {
  category: null,
  urgency: null,
  country: null,
};

// Use bundled data directly (no API call needed for local data)
const allTeas: Tea[] = teasData as Tea[];

export function useTeas() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Tea[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTea, setSelectedTea] = useState<Tea | null>(null);

  // Filter teas locally
  const filteredTeas = (searchResults ?? allTeas).filter((tea) => {
    if (filters.category && tea.category !== filters.category) return false;
    if (filters.urgency && tea.urgency !== filters.urgency) return false;
    if (filters.country && tea.origin.country !== filters.country) return false;
    return true;
  });

  // Search via API (vector similarity)
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const activeFilters: Record<string, string> = {};
      if (filters.category) activeFilters.category = filters.category;
      if (filters.urgency) activeFilters.urgency = filters.urgency;
      if (filters.country) activeFilters.country = filters.country;

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          filters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
          top_k: 20,
        }),
      });
      const data = (await res.json()) as { results: { tea: Tea }[] };
      setSearchResults(data.results.map((r) => r.tea));
    } catch {
      // Fallback: simple text search on local data
      const q = query.toLowerCase();
      const results = allTeas.filter(
        (t) =>
          t.name.primary.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.category_label.toLowerCase().includes(q) ||
          t.producer.name.toLowerCase().includes(q) ||
          t.origin.region.toLowerCase().includes(q) ||
          t.origin.country.toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  }, [filters]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => search(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, search]);

  // Derived data for filter options
  const categories = [...new Set(allTeas.map((t) => t.category))].sort();
  const categoryLabels = Object.fromEntries(
    allTeas.map((t) => [t.category, t.category_label])
  );
  const countries = [...new Set(allTeas.map((t) => t.origin.country))].sort();
  const urgencies: TeaUrgency[] = ["now", "soon", "summer", "calm", "stable"];


  const clearFilters = () => setFilters(emptyFilters);

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return {
    teas: filteredTeas,
    allTeas,
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    searchQuery,
    setSearchQuery,
    isSearching,
    selectedTea,
    setSelectedTea,
    // Filter options
    categories,
    categoryLabels,
    countries,
    urgencies,
  };
}
