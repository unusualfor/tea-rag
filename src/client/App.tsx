import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTeas } from "@/hooks/use-teas";
import { TeaCard } from "@/components/tea-card";
import { TeaDetail } from "@/components/tea-detail";
import { FiltersSidebar } from "@/components/filters-sidebar";
import { SearchBar } from "@/components/search-bar";
import { ChatView } from "@/components/chat-view";
import { SlidersHorizontal, LayoutGrid, MessageCircle } from "lucide-react";

type Mode = "browse" | "ask";

export function App() {
  const {
    teas,
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
    categories,
    categoryLabels,
    countries,
    urgencies,
  } = useTeas();

  const [mode, setMode] = useState<Mode>("browse");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtersContent = (
    <FiltersSidebar
      filters={filters}
      onFilterChange={updateFilter}
      onClear={clearFilters}
      hasActiveFilters={hasActiveFilters}
      categories={categories}
      categoryLabels={categoryLabels}
      countries={countries}
      urgencies={urgencies}
    />
  );

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex items-center justify-between h-14 px-4 sm:px-6">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                It's a journey, not a race: Francesco's Tea Collection
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Mode toggle */}
              <div className="flex rounded-lg border p-0.5 bg-muted/50">
                <button
                  onClick={() => setMode("browse")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${
                    mode === "browse"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Browse</span>
                </button>
                <button
                  onClick={() => setMode("ask")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${
                    mode === "ask"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ask</span>
                </button>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums hidden sm:block">
                {teas.length}{teas.length !== allTeas.length ? ` / ${allTeas.length}` : ""} teas
              </div>
            </div>
          </div>
        </header>

        <div className="container px-4 sm:px-6 py-6">
          <div className="flex gap-8">
            {/* Sidebar — desktop, browse mode only */}
            {mode === "browse" && (
              <aside className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
                  {filtersContent}
                </div>
              </aside>
            )}

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {mode === "browse" ? (
                <>
                  {/* Search + mobile filter toggle */}
                  <div className="flex gap-2 mb-6">
                    <div className="flex-1">
                      <SearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        isSearching={isSearching}
                      />
                    </div>
                    {/* Mobile filter button */}
                    <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                      <SheetTrigger
                        className="lg:hidden shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md border border-input bg-background h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </SheetTrigger>
                      <SheetContent side="left" className="w-80 pt-10">
                        <SheetTitle className="sr-only">Filters</SheetTitle>
                        {filtersContent}
                      </SheetContent>
                    </Sheet>
                  </div>

                  {/* Active filters indicator */}
                  {hasActiveFilters && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                      <span>Filtered</span>
                      <span>·</span>
                      <button
                        onClick={clearFilters}
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >
                        clear all
                      </button>
                    </div>
                  )}

                  {/* Tea grid */}
                  {teas.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {teas.map((tea) => (
                        <TeaCard
                          key={tea.id}
                          tea={tea}
                          onClick={setSelectedTea}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <p className="text-muted-foreground">
                        No teas match your current filters.
                      </p>
                      <button
                        onClick={() => {
                          clearFilters();
                          setSearchQuery("");
                        }}
                        className="text-sm text-primary underline underline-offset-2 mt-2"
                      >
                        Reset everything
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Chat mode */
                <ChatView onTeaClick={setSelectedTea} />
              )}
            </main>
          </div>
        </div>

        {/* Tea detail modal */}
        <TeaDetail
          tea={selectedTea}
          open={selectedTea !== null}
          onClose={() => setSelectedTea(null)}
        />
      </div>
    </TooltipProvider>
  );
}

