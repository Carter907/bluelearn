import type { InferRequestType } from "hono/client";
import type { FetchOptions } from "@/lib/api/http";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/http";

const guides = client.guides;

export async function listGuides({ signal }: FetchOptions = {}) {
  const res = await guides.$get(undefined, { init: { signal } });
  await assertOk(res);

  const { guides: data } = await res.json();
  return data;
}

export async function createGuide(
  body: InferRequestType<typeof guides.$post>["json"]
) {
  const res = await guides.$post({ json: body });
  if (!res.ok) return assertOk(res) as Promise<never>;

  const { revision_id } = await res.json();
  return revision_id;
}
