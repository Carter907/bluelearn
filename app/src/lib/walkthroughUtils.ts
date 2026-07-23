import { client } from "@/lib/api/apiClient";
import guidesData from "@/data/guides.json";

export type WalkthroughNode = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  level: number; // mapped from depth
};

// Map for O(1) guide lookup (used for mocking in UI components)
export const guidesMap = new Map(guidesData.map((g) => [g.slug, g]));

export const fetchWalkthrough = async (
  targetSlug: string
): Promise<Array<WalkthroughNode>> => {
  const res = await client.guides[":slug"].walkthrough.$get({
    param: { slug: targetSlug },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch walkthrough");
  }

  const data = await res.json();

  return data.nodes.map((node: any) => ({
    id: node.id,
    slug: node.slug,
    title: node.title,
    summary: node.summary,
    level: node.depth,
  }));
};
