import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ChangeBadge = ({
  tone,
  children,
}: {
  tone: "new" | "existing";
  children: React.ReactNode;
}) => {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-mono tracking-[0.06em] uppercase",
        tone === "new"
          ? "bg-brand-blue/15 text-brand-dk-blue dark:text-brand-blue"
          : "bg-muted-foreground/8 text-muted-foreground"
      )}
    >
      {children}
    </Badge>
  );
};
