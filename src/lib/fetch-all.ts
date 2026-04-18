/**
 * Supabase returns at most 1000 rows by default. For large tenants this
 * silently truncates report data (e.g. combined-grade fetches stalling at
 * ~112 learners × 9 subjects = 1008 score rows). This helper pages through
 * the full result set 1000 rows at a time using `.range()`.
 *
 * Usage:
 *   const rows = await fetchAllPaged(() =>
 *     supabase.from('scores').select('*').eq('term', t).eq('year', y)
 *   );
 */
export async function fetchAllPaged<T = any>(
  builder: () => any, // PostgrestFilterBuilder; typed loosely so callers don't need the SDK type
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Hard cap to avoid runaway loops if a query returns infinite rows.
  for (let i = 0; i < 50; i++) {
    const to = from + pageSize - 1;
    const { data, error } = await builder().range(from, to);
    if (error) throw error;
    const batch = (data || []) as T[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
