import type { FetchOptions } from "@/lib/api/http";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/http";

const subjects = client.subjects;

export async function listSubjects({ signal }: FetchOptions = {}) {
  const res = await subjects.$get(undefined, { init: { signal } });
  await assertOk(res);

  const { subjects: data } = await res.json();
  return data;
}
