"use client";

import { useOptimistic, useTransition } from "react";
import { toggleRoundItem } from "../actions";

export function RoundCheck({ itemKey, done, label }: { itemKey: string; done: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={label}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleRoundItem(itemKey, !optimistic);
        })
      }
      className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-sm border border-ink transition aria-checked:bg-ink"
    >
      {optimistic && (
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5l2.5 2.5L10 3.5" stroke="var(--inverse)" strokeWidth="1.8" fill="none" />
        </svg>
      )}
    </button>
  );
}
