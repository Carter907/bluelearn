import guidesData from "@/data/guides.json";

export type WalkthroughNode = {
  slug: string;
  title: string;
  summary: string;
  level: number;
};

// Map for O(1) guide lookup
export const guidesMap = new Map(guidesData.map((g) => [g.slug, g]));

export const computeWalkthrough = (
  targetSlug: string
): Array<WalkthroughNode> => {
  // 1. Find all nodes in the transitive prerequisite closure
  const closure = new Set<string>();
  const queue = [targetSlug];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!closure.has(current)) {
      closure.add(current);
      const guide = guidesMap.get(current);
      if (guide) {
        for (const prereq of guide.prerequisites) {
          queue.push(prereq);
        }
      }
    }
  }

  // 2. Compute levels for each node in the closure based on longest path depth
  const memo: Record<string, number> = {};

  const getLevel = (slug: string): number => {
    if (slug in memo) return memo[slug];

    const guide = guidesMap.get(slug);
    if (!guide || guide.prerequisites.length === 0) {
      memo[slug] = 1;
      return 1;
    }

    const maxPrereqLevel = Math.max(
      ...guide.prerequisites.map((p: string) => getLevel(p))
    );

    memo[slug] = maxPrereqLevel + 1;
    return maxPrereqLevel + 1;
  };

  const result: Array<WalkthroughNode> = [];
  for (const slug of closure) {
    const guide = guidesMap.get(slug);
    if (guide) {
      result.push({
        slug,
        title: guide.title,
        summary: guide.summary,
        level: getLevel(slug),
      });
    }
  }

  return result;
};
