import type { InferRequestType } from "hono/client";
import type { GuideListItem } from "@bluelearn/schemas";
import { client } from "@/lib/api/apiClient";
import { assertOk, collectAll } from "@/lib/api/apiHelpers";

const guides = client.guides;

type FetchOptions = { signal?: AbortSignal };

export async function listGuides({ signal }: FetchOptions = {}) {
  return collectAll<GuideListItem>(async (query) => {
    const res = await guides.$get({ query }, { init: { signal } });
    if (!res.ok) return assertOk(res) as Promise<never>;

    const { guides: items, total } = await res.json();
    return { items, total };
  });
}

export async function createGuide(
  body: InferRequestType<typeof guides.$post>["json"]
) {
  const res = await guides.$post({ json: body });
  if (!res.ok) return assertOk(res) as Promise<never>;

  const { revision_id } = await res.json();
  return revision_id;
}
