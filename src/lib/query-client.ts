import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60 * 24 * 30,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "porylist-cache-v9",
  throttleTime: 1000,
});

/**
 * Queries backed by bundled static imports resolve instantly from the JS
 * chunk — persisting their multi-MB payloads to localStorage wastes quota
 * and makes every cache write serialize megabytes of redundant JSON.
 */
const BUNDLED_QUERY_KEYS = new Set([
  "pokemon-summary-list",
  "pokemon-summary-map",
  "pokemon-move-gens",
]);

export const dehydrateOptions = {
  shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
    query.state.status === "success" && !BUNDLED_QUERY_KEYS.has(query.queryKey[0] as string),
};
