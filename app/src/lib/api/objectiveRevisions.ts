import type { InferRequestType } from "hono/client";
import { client } from "@/lib/api/apiClient";
import { assertOk } from "@/lib/api/apiHelpers";

const revisions = client["objective-revisions"];

type FetchOptions = { signal?: AbortSignal };

export async function getObjectiveRevision(
  id: string,
  { signal }: FetchOptions = {}
) {
  const res = await revisions[":id"].$get(
    { param: { id } },
    { init: { signal } }
  );
  await assertOk(res);

  return res.json();
}

export async function updateObjectiveRevision(
  id: string,
  body: InferRequestType<(typeof revisions)[":id"]["$patch"]>["json"]
) {
  const res = await revisions[":id"].$patch({ param: { id }, json: body });
  await assertOk(res);

  return res.json();
}

export async function submitObjectiveRevision(id: string) {
  const res = await revisions[":id"].publish.$post({ param: { id } });
  await assertOk(res);

  const { slug } = await res.json();
  return slug;
}
