import { useCallback, useEffect, useState } from "react";

/** Per-browser state for the demo workspace. Storage can be unavailable, so every access is guarded. */
export interface TendrilState {
  done: string[];
  replied: string[];
  greeted: string[];
  bioDraft: string | null;
}

const KEY = "tendril:v1";
const EMPTY: TendrilState = { done: [], replied: [], greeted: [], bioDraft: null };

function load(): TendrilState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function useTendril() {
  const [state, setState] = useState<TendrilState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage blocked: state lives for this visit only */
    }
  }, [state]);

  const toggle = useCallback((list: "done" | "replied" | "greeted", id: string) => {
    setState((s) => ({
      ...s,
      [list]: s[list].includes(id) ? s[list].filter((x) => x !== id) : [...s[list], id],
    }));
  }, []);

  const setBio = useCallback((bioDraft: string) => setState((s) => ({ ...s, bioDraft })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  return { state, toggle, setBio, reset };
}

export type Tendril = ReturnType<typeof useTendril>;
