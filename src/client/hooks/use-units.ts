import { useCallback, useEffect, useState } from "react";
import type { UnitSystem } from "@/lib/tea-utils";

const STORAGE_KEY = "tea-rag:units";

function readStored(): UnitSystem {
  if (typeof window === "undefined") return "metric";
  return window.localStorage.getItem(STORAGE_KEY) === "imperial" ? "imperial" : "metric";
}

// Module-level subscribers so every mounted hook stays in sync — the toggle
// lives in the cold brew panel but temperatures elsewhere read the same value.
const listeners = new Set<(u: UnitSystem) => void>();
let current: UnitSystem = readStored();

export function useUnits() {
  const [units, setUnits] = useState<UnitSystem>(current);

  useEffect(() => {
    listeners.add(setUnits);
    return () => {
      listeners.delete(setUnits);
    };
  }, []);

  const update = useCallback((next: UnitSystem) => {
    current = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((l) => l(next));
  }, []);

  const toggle = useCallback(() => {
    update(current === "metric" ? "imperial" : "metric");
  }, [update]);

  return { units, setUnits: update, toggle };
}
