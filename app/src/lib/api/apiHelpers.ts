// The API answers failures with { error: string }, so surface that message so
// callers can render it, and fall back to the status when the body isn't JSON.
export async function assertOk(res: Response) {
  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  throw new Error(body?.error ?? `Request failed (${res.status})`);
}

export const PAGE_LIMIT = 100;
export async function collectAll<T>(
  fetchPage: (query: {
    page: string;
    limit: string;
  }) => Promise<{ items: Array<T>; total: number }>
): Promise<Array<T>> {
  const out: Array<T> = [];
  let items: Array<T> = [];
  let total = Infinity;
  let page = 1;

  do {
    ({ items, total } = await fetchPage({
      page: String(page),
      limit: String(PAGE_LIMIT),
    }));
    out.push(...items);
    page++;
  } while (out.length < total && items.length !== 0);

  return out;
}
