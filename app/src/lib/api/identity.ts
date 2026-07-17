import type { FetchOptions } from "@/lib/api/http";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/http";

const me = client.me;

// The caller's own profile + roles. Needs an authed request.
export async function getMyIdentity({ signal }: FetchOptions = {}) {
  const res = await me.$get(undefined, { init: { signal } });
  await assertOk(res);

  return res.json();
}
