import { GuideGraphNode } from "./GuideGraphNode";
import type { GraphNodeData } from "./useGraphLayout";

// isSelected comes from WalkthroughGraph's getNodeState.
type WalkthroughNodeData = GraphNodeData & { isSelected: boolean };

export function WalkthroughNode({ data }: { data: WalkthroughNodeData }) {
  return <GuideGraphNode data={data} isSelected={data.isSelected} />;
}
