import { Handle, Position } from "@xyflow/react";

export function WalkthroughNode({ data }: { data: any }) {
  const { isTarget, title, isHovered, isDimmed } = data;

  return (
    <div
      className={`relative flex min-w-[200px] flex-col gap-2 rounded-xl border-2 bg-card p-3 transition-all duration-150 select-none ${
        isHovered
          ? "z-10 scale-105 border-primary shadow-md ring-4 ring-primary/40"
          : ""
      } ${isDimmed ? "opacity-30" : ""} ${
        isTarget
          ? "cursor-default border-primary shadow-sm"
          : "cursor-pointer border-border shadow-sm hover:border-primary/50"
      }`}
    >
      <Handle
        type="source"
        position={Position.Top}
        className="-top-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="flex flex-col gap-1 text-sm font-semibold text-foreground">
            {title}
            {isTarget && (
              <span className="self-start rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                Target
              </span>
            )}
          </h4>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Bottom}
        className="-bottom-1 h-2 w-8 rounded-full !border-none !bg-primary/40"
      />
    </div>
  );
}
