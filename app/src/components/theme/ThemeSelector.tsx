import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/themeProvider";
import { ThemePreview } from "@/components/theme/ThemePreview";

const themes = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {themes.map((t) => {
        const selected = theme === t.id;

        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "group relative overflow-hidden rounded-md border bg-card p-3 text-left transition-all duration-200",
              "hover:scale-105 hover:border-primary hover:shadow-md",
              selected && "border-primary shadow-lg ring-2 ring-primary/20"
            )}
          >
            <ThemePreview theme={t.id} />

            <div className="mt-3 flex items-center justify-between">
              <span className="font-medium">{t.name}</span>

              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-all",
                  selected
                    ? "scale-100 bg-primary text-primary-foreground"
                    : "scale-0"
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
