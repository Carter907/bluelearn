import { GuideGraphNode } from "./GuideGraphNode";
import type { GraphNodeData } from "./useGraphLayout";
import { Checkbox } from "@/components/ui/checkbox";

// The extras come from CurationGraph's getNodeState.
type CurationNodeData = GraphNodeData & {
  isChecked: boolean;
  selectedOrder: number | null;
};

export function CurationNode({ data }: { data: CurationNodeData }) {
  const { isTarget, isChecked, selectedOrder } = data;

  return (
    <GuideGraphNode
      data={data}
      isSelected={isChecked && !isTarget}
      leading={
        !isTarget && (
          <Checkbox checked={isChecked} className="pointer-events-none mt-1" />
        )
      }
      badge={
        selectedOrder !== null && (
          <div className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white shadow-md ring-4 ring-background">
            {selectedOrder}
          </div>
        )
      }
    />
  );
}
