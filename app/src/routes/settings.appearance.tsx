import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";
import { ThemeSelector } from "@/components/theme/ThemeSelector";

export const Route = createFileRoute("/settings/appearance")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
          Appearance
        </h1>
      </div>

      <Separator className="mb-8 bg-border" />

      <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
        Choose Theme
      </h2>

      <Separator className="mb-4 bg-border" />

      <ThemeSelector />
    </div>
  );
}
