import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SettingsSidebar } from "@/components/sidebar/SettingsSidebar";

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto max-w-[1280px] bg-background">
      <div className="flex min-h-[calc(100svh_-_64px)]">
        {/* Left Sidebar Navigation */}
        <SettingsSidebar />
        <div className="w-64" />

        {/* Right Content Area */}
        <div className="flex-1 border-l px-8 py-8 lg:px-16">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
