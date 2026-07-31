import { cn } from "@/lib/utils";

type ThemePrevProp = {
  theme: "light" | "dark";
};

export const ThemePreview = ({ theme }: ThemePrevProp) => {
  const previewClass = theme === "dark" ? "preview-dark" : "preview-light";

  return (
    <div
      className={cn(
        "preview-border overflow-hidden rounded-lg border",
        previewClass
      )}
    >
      {/* Browser Bar */}
      <div className="preview-header preview-border flex h-8 items-center gap-1 border-b px-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
      </div>

      <div className="preview-bg flex h-36">
        {/* Sidebar */}
        <div className="preview-sidebar preview-border w-24 border-r p-2">
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="preview-line h-2 rounded" />
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="preview-bg flex-1 p-3">
          <div className="preview-line mb-3 h-3 w-24 rounded" />

          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="preview-card preview-border h-10 rounded-lg border"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
