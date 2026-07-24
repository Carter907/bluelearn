import { useEffect, useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import type { WalkthroughData } from "@/lib/walkthroughUtils";
import { Separator } from "@/components/ui/separator";

import { Route as ObjectiveRoute } from "@/routes/objectives.$slug";

import { getPathBySlug } from "@/lib/getData";
import { WalkthroughGraph } from "@/components/graph-view/WalkthroughGraph";
import { fetchObjectiveGraph } from "@/lib/walkthroughUtils";

import objectives from "@/data/objectives.json";

export const Route = createFileRoute("/objectives/$slug/graph")({
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();

  const objective = getPathBySlug(objectives, slug);
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<WalkthroughData | null>(null);

  useEffect(() => {
    fetchObjectiveGraph(slug).then(setGraphData).catch(console.error);
  }, [slug]);

  if (!objective) {
    throw notFound();
  }

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-[1280px] overflow-y-auto border-x bg-background">
      <section className="flex h-full flex-col px-10 py-4 lg:px-16">
        {/* MAIN */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-mono text-[14px] tracking-[0.08em] text-muted-foreground uppercase">
            Graph View: {objective.title}
          </h1>
          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={ObjectiveRoute.to}
              params={{ slug: slug }}
              className="btn-outline"
            >
              View Objective
            </Link>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Graph */}
        <div className="min-h-[600px] w-full flex-1 overflow-hidden rounded-xl border border-border bg-muted/10">
          {graphData && (
            <WalkthroughGraph
              walkthroughData={graphData}
              targetSlug={slug}
              hoveredGuide={hoveredGuide}
              onHoverGuide={setHoveredGuide}
            />
          )}
        </div>
      </section>
    </div>
  );
}
