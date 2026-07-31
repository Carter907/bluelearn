// Run large .in() queries in batches to avoid PostgREST's URI length limit.
// Results are merged so callers can treat it like a single query.
const BATCH_SIZE = 100;

type BatchResult<Row, E> = { data: Row[] | null; error: E | null };

export async function selectInBatches<Row, E>(
  ids: string[],
  run: (batch: string[]) => PromiseLike<BatchResult<Row, E>>
): Promise<BatchResult<Row, E>> {
  const rows: Row[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const { data, error } = await run(ids.slice(i, i + BATCH_SIZE));
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }

  return { data: rows, error: null };
}
