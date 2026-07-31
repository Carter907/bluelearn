import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/review")({
  ssr: false,
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
