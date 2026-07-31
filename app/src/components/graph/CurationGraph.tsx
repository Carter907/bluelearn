import { useCallback } from "react";
import { GuideGraph } from "./GuideGraph";
import { CurationNode } from "./CurationNode";
import type { Walkthrough } from "@bluelearn/schemas";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  curationNode: CurationNode,
};

type CurationGraphProps = {
  walkthroughData: Walkthrough;
  curatedSequence: Array<string>;
  targetSlug: string;
  onToggleGuide: (slug: string, isChecked: boolean) => void;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
};

export function CurationGraph({
  curatedSequence,
  targetSlug,
  onToggleGuide,
  ...rest
}: CurationGraphProps) {
  const getNodeState = useCallback(
    (slug: string) => {
      const selectedOrder = curatedSequence.indexOf(slug);
      return {
        isChecked: slug === targetSlug || selectedOrder !== -1,
        selectedOrder: selectedOrder !== -1 ? selectedOrder + 1 : null,
      };
    },
    [curatedSequence, targetSlug]
  );

  const onNodeClick = useCallback(
    (slug: string) => {
      if (slug === targetSlug) return;
      onToggleGuide(slug, !curatedSequence.includes(slug));
    },
    [curatedSequence, targetSlug, onToggleGuide]
  );

  return (
    <GuideGraph
      {...rest}
      targetSlug={targetSlug}
      nodeType="curationNode"
      nodeTypes={nodeTypes}
      getNodeState={getNodeState}
      onNodeClick={onNodeClick}
    />
  );
}
