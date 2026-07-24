import { client } from "@/lib/api/apiClient";

export type WalkthroughNode = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: number;
  word_count: number;
  tags: Array<{ slug: string; name: string }>;
};

export type WalkthroughEdge = {
  from_id: string;
  to_id: string;
};

export type WalkthroughData = {
  nodes: Array<WalkthroughNode>;
  edges: Array<WalkthroughEdge>;
};

export const fetchWalkthrough = async (
  targetSlug: string
): Promise<WalkthroughData> => {
  const res = await client.guides[":slug"].walkthrough.$get({
    param: { slug: targetSlug },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch walkthrough");
  }

  const data = await res.json();
  return data;
};
