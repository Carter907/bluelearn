import { Link, useRouterState } from "@tanstack/react-router";
import { Palette, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const items = [
  {
    label: "Account",
    to: "/settings/account",
    icon: Settings,
  },
  {
    label: "Public Profile",
    to: "/settings/profile",
    icon: User,
  },
  {
    label: "Appearance",
    to: "/settings/appearance",
    icon: Palette,
  },
];

export const SettingsSidebar = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="fixed top-[70px] h-[calc(100vh-70px)] w-64 shrink-0 overflow-y-auto px-6 py-6">
      <div className="mb-6">
        <h2 className="font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase">
          Settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your Bluelearn account and preferences.
        </p>
      </div>

      <ul>
        {items.map((item) => {
          const active = pathname === item.to;

          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "data-label flex items-center gap-4 px-2 py-4 hover:font-bold hover:text-brand-blue",
                  active && "!font-bold !text-brand-blue"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
              <Separator />
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
