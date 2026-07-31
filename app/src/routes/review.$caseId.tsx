import { useMemo } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

import type { ReaderGuide } from "@/components/GuideReader";
import { GuideReader } from "@/components/GuideReader";

import { ApiError } from "@/lib/api/apiHelpers";
import { getReviewCase } from "@/lib/api/reviews";

import "katex/dist/katex.min.css";
import { ReviewSidebar } from "@/components/sidebar/ReviewSidebar";

export const Route = createFileRoute("/review/$caseId")({
  loader: async ({ params, abortController }) => {
    try {
      return await getReviewCase(params.caseId, {
        signal: abortController.signal,
      });
    } catch (err) {
      // The API decides who may read a case, so treat a refusal as a dead link
      if (err instanceof ApiError && (err.status === 403 || err.status === 404))
        throw notFound();
      throw err;
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { caseId } = Route.useParams();
  const revisionData = Route.useLoaderData();

  const revision = revisionData.revision;

  // Prevent guide content from re-rendering on each review action change.
  const guideContent = useMemo(() => {
    if (!revision) return null;

    const guide: ReaderGuide = {
      slug: "",
      variant_slug: null,
      title: revision.title ?? "",
      author: "",
      summary: revision.summary ?? null,
      body: revision.body ?? null,
      duration_minutes: revision.duration_minutes,
      created_at: revision.created_at,
      tags: revision.tags,
      prerequisites: [],
    };

    return <GuideReader guide={guide} />;
  }, [revision]);

  return (
    <div className="mx-auto h-[calc(100vh-70px)] max-w-7xl border-x bg-background">
      <section className="grid grid-cols-[320px_1fr] border-b">
        <ReviewSidebar
          caseId={caseId}
          revision={revision}
          revisionData={revisionData}
        />

        {/* MAIN */}
        <main className="h-[calc(100vh-70px)] min-w-0 overflow-y-auto px-10 py-6 lg:px-16">
          {guideContent ?? (
            <p className="font-mono text-[11px] tracking-[0.08em] text-red-500 uppercase">
              No guide revision found to display.
            </p>
          )}
        </main>
      </section>
    </div>
  );
}
