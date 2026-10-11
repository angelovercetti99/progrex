/**
 * The link to the Apple Watch app (docs/decisoes.md §52). Only the iPhone has
 * one (bridge.ios.ts); everywhere else there's nothing to talk to.
 */
export type WatchBridge = {
  /** Replaces what the watch shows (it keeps only the latest, even if asleep). */
  publish(payload: Record<string, string>): void;
  /** Messages from the watch. Returns a function that stops listening. */
  onMessage(listener: (payload: Record<string, unknown>) => void): () => void;
};

export const watchBridge: WatchBridge | null = null;
