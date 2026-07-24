import { useCallback, useRef } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import { useNavigate } from "@tanstack/react-router";
import { WalkthroughNode as WalkthroughNodeComponent } from "./WalkthroughNode";
import { useGraphLayout } from "./useGraphLayout";
import type { Node } from "@xyflow/react";
import type { WalkthroughData, WalkthroughNode } from "@/lib/walkthroughUtils";
import "@xyflow/react/dist/style.css";

const nodeTypes = {
  walkthroughNode: WalkthroughNodeComponent,
};

type WalkthroughGraphProps = {
  walkthroughData: WalkthroughData;
  targetSlug: string;
  hoveredGuide: string | null;
  onHoverGuide: (slug: string | null) => void;
};

export function WalkthroughGraph({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  onHoverGuide,
}: WalkthroughGraphProps) {
  const navigate = useNavigate();

  const getNodeData = useCallback((node: WalkthroughNode) => {
    return {
      summary: node.summary,
      level: node.level,
      duration: Math.max(1, Math.ceil(node.word_count / 225)),
      tags: node.tags,
    };
  }, []);

  const { nodes, edges, onNodesChange, onEdgesChange } = useGraphLayout({
    walkthroughData,
    targetSlug,
    hoveredGuide,
    nodeType: "walkthroughNode",
    getNodeData,
  });

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      navigate({ to: `/guides/${node.id}` });
    },
    [navigate]
  );

  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleNodeMouseEnter = useCallback(
    (_: any, node: Node) => {
      clearTimeout(hoverTimeoutRef.current);
      onHoverGuide(node.id);
    },
    [onHoverGuide]
  );

  const handleNodeMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      onHoverGuide(null);
    }, 50);
  }, [onHoverGuide]);

  return (
    <div className="relative h-full min-h-[500px] w-full">
      <ReactFlow
        key={targetSlug}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        className="bg-transparent"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background
          color="hsl(var(--muted-foreground) / 0.2)"
          gap={24}
          size={2}
        />
        <Controls
          showInteractive={false}
          className="overflow-hidden rounded-xl border-border! bg-background! shadow-md! [&>button]:border-b-border! [&>button]:text-foreground! hover:[&>button]:bg-muted!"
        />
      </ReactFlow>
    </div>
  );
}
