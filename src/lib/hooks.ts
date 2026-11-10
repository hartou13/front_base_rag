"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** false during SSR / hydration, true once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
