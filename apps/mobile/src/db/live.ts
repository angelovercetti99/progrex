import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * "Live queries": screens re-read their data when the tables they use change.
 *
 * How: every write calls `notifyChanged('sets')` (our write helpers do it for
 * you). Each `useLiveQuery` listens and re-runs if one of its tables changed.
 * This is the publish/subscribe pattern: writers publish, readers subscribe.
 */
export type TableName =
  'preferences' | 'exercises' | 'locations' | 'mesocycles' | 'workouts' | 'workout_exercises' | 'sets';

type Listener = (changed: ReadonlySet<TableName>) => void;

const listeners = new Set<Listener>();

export function notifyChanged(...tables: TableName[]): void {
  const changed = new Set(tables);
  listeners.forEach((listener) => listener(changed));
}

type LiveQueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'ready'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error };

/**
 * Runs `query` now and again whenever one of `tables` changes.
 * `deps`: values the query depends on (e.g. a workout id) — like useEffect.
 */
export function useLiveQuery<T>(
  query: () => Promise<T>,
  tables: TableName[],
  deps: unknown[]
): LiveQueryState<T> {
  const [state, setState] = useState<LiveQueryState<T>>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });

  // Always call the latest `query` (it's a new function on every render).
  const queryRef = useRef(query);
  useLayoutEffect(() => {
    queryRef.current = query;
  });

  // Turn the arrays into strings so React can compare them between renders.
  const depsKey = JSON.stringify(deps);
  const tablesKey = tables.join(',');

  useEffect(() => {
    let cancelled = false;
    const watched = new Set(tablesKey.split(','));

    function load() {
      queryRef.current().then(
        (data) => !cancelled && setState({ status: 'ready', data, error: undefined }),
        (error: unknown) =>
          !cancelled &&
          setState({
            status: 'error',
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          })
      );
    }

    load();
    const listener: Listener = (changed) => {
      if ([...changed].some((table) => watched.has(table))) {
        load();
      }
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [depsKey, tablesKey]);

  return state;
}
