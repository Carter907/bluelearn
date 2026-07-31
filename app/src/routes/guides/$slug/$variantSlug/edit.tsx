import { defineStepper } from "@stepperize/react";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { Guide } from "@bluelearn/schemas";
import type { GuideContribution } from "@/types/contributions";
import type { GuideType } from "@/types/guides";
import { listGuides } from "@/lib/api/guides";
import { getMyIdentity } from "@/lib/api/identity";
import { listSubjects } from "@/lib/api/subjects";
import {
  getRevision,
  submitRevision,
  updateRevision,
} from "@/lib/api/guideRevisions";
import { createVariantRevision, getVariantBySlug } from "@/lib/api/variants";
import { uploadMedia } from "@/lib/api/media";
import { estimateReadMinutes } from "@/lib/guideUtils";

import guidesData from "@/data/guides.json";

import { GuideDetails } from "@/components/contribute/steps/GuideDetails";
import { Content } from "@/components/contribute/steps/Content";
import { Submit } from "@/components/contribute/steps/Submit";

export const Route = createFileRoute("/guides/$slug/$variantSlug/edit")({
  validateSearch: (search: Record<string, unknown>): { draft?: string } => ({
    draft: typeof search.draft === "string" ? search.draft : undefined,
  }),
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ params, deps }) => {
    const variant = await getVariantBySlug(params.slug, params.variantSlug);
    // A variant with nothing published has no snapshot to revise.
    if (!variant.current) throw notFound();

    // Resuming picks up the open draft; otherwise seed from what's live.
    const snapshot = await getRevision(deps.draft ?? variant.current.id);
    return {
      variant,
      current: variant.current,
      snapshot,
      draftId: deps.draft ?? null,
    };
  },
  component: RouteComponent,
});

const StepperInstance = defineStepper([
  { id: "guide-details", title: "Edit Details" },
  { id: "content", title: "Edit Content" },
  { id: "submit", title: "Preview" },
]);

function RouteComponent() {
  const { variant, current, snapshot, draftId } = Route.useLoaderData();
  const { Stepper } = StepperInstance;
  const router = useRouter();

  // A tag still awaiting approval is not pickable yet, so it resumes in the
  // new-subject list rather than the picker.
  const approved = snapshot.subjects.filter((s) => s.status === "published");
  const pending = snapshot.subjects.filter((s) => s.status !== "published");

  const [guideContData, setGuideContData] = useState<GuideContribution>(() => ({
    type: snapshot.knowledge_type === "practical" ? "practical" : "theoretical",
    title: snapshot.revision.title ?? "",
    summary: snapshot.revision.summary ?? "",
    body: snapshot.revision.body ?? "",
    subjects: approved.map((s) => s.id),
    newSubjects: pending.map((s) => ({
      id: s.id,
      name: s.name,
      summary: s.summary ?? "",
    })),
    prereqs: snapshot.prerequisites,
    todoPrereqs: snapshot.todos,
  }));

  const [changeSummary, setChangeSummary] = useState(
    snapshot.revision.change_summary ?? ""
  );

  const [revisionId, setRevisionId] = useState<string | null>(draftId);
  const [submitting, setSubmitting] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<
    Array<{ id: string; name: string }>
  >(() => approved.map((s) => ({ id: s.id, name: s.name })));

  const [guideOptions, setGuideOptions] = useState<
    Array<{
      slug: string | null;
      title: string | null;
      summary: string | null;
    }>
  >(guidesData);

  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };

    listSubjects(opts)
      .then((data) => {
        setSubjectOptions((prev) => {
          const listed = new Set(data.map((s) => s.id));
          return [...data, ...prev.filter((s) => !listed.has(s.id))];
        });
      })
      .catch(() => {});
    listGuides(opts)
      .then((data) => {
        if (data.length > 0) setGuideOptions(data);
      })
      .catch(() => {});
    getMyIdentity(opts)
      .then((data) => setUsername(data.profile.username))
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const previewGuide: Guide = useMemo(() => {
    const nameById = new Map(
      subjectOptions.map((s) => [s.id, s.name] as const)
    );
    const titleBySlug = new Map(
      guideOptions
        .filter((g) => g.slug)
        .map((g) => [g.slug as string, g.title ?? (g.slug as string)] as const)
    );

    return {
      slug: snapshot.base_slug ?? "",
      variant_slug: variant.slug,
      title: guideContData.title || "Untitled guide",
      author: username ?? "",
      summary: guideContData.summary,
      body: guideContData.body,
      duration_minutes: estimateReadMinutes(guideContData.body),
      created_at: current.created_at,
      tags: [
        ...guideContData.subjects.map((id) => ({
          slug: id,
          name: nameById.get(id) ?? id,
        })),
        ...guideContData.newSubjects.map((s) => ({
          slug: s.name,
          name: s.name,
        })),
      ],
      prerequisites: guideContData.prereqs.map((slug) => ({
        slug,
        title: titleBySlug.get(slug) ?? slug,
      })),
    };
  }, [
    guideContData,
    subjectOptions,
    guideOptions,
    username,
    snapshot,
    variant,
    current,
  ]);

  const guideType: GuideType | undefined =
    snapshot.knowledge_type === "practical" ||
    snapshot.knowledge_type === "theoretical"
      ? snapshot.knowledge_type
      : undefined;

  // Type, prerequisites and todos belong to the guide base, so a revision
  // can't carry them.
  const draftFields = () => ({
    title: guideContData.title || null,
    summary: guideContData.summary || null,
    body: guideContData.body || null,
    change_summary: changeSummary || null,
    tags: [
      ...guideContData.subjects,
      ...guideContData.newSubjects
        .map((s) => s.id)
        .filter((id): id is string => !!id),
    ],
    newSubjects: guideContData.newSubjects
      .filter((s) => !s.id)
      .map((s) => ({
        name: s.name,
        summary: s.summary || null,
      })),
  });

  const creatingRef = useRef<Promise<string> | null>(null);

  const persistDraft = async () => {
    if (revisionId) {
      await updateRevision(revisionId, draftFields());
      return revisionId;
    }

    if (!creatingRef.current) {
      creatingRef.current = createVariantRevision(variant.id)
        .then(async (id) => {
          setRevisionId(id);
          await updateRevision(id, draftFields());
          return id;
        })
        .finally(() => {
          creatingRef.current = null;
        });
    }
    return creatingRef.current;
  };

  const uploadGuideImage = async (file: File) => {
    try {
      const id = revisionId ?? (await persistDraft());
      const { url } = await uploadMedia(file, id);
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload image");
      throw e;
    }
  };

  const saveDraft = async () => {
    setSubmitting(true);
    try {
      await persistDraft();
      // Refresh the cached snapshot so coming back here reseeds from the save.
      await router.invalidate();
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async () => {
    setSubmitting(true);
    try {
      const id = await persistDraft();
      await submitRevision(id);
      await router.invalidate();
      toast.success("Submitted for review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[max(calc(100vh-65px),750px)] w-full max-w-[1280px] flex-col border-x bg-background">
      <section className="flex min-h-0 flex-1 flex-col border-b px-8 py-8 lg:px-16">
        <Stepper.Root
          linear
          className="flex min-h-0 w-full flex-1 flex-col gap-8"
        >
          {() => (
            <>
              <Stepper.List className="flex w-full items-center justify-center text-sm">
                <Stepper.Items>
                  {(step: any, index: number) => (
                    <Fragment key={step.id}>
                      {index > 0 && (
                        <ChevronRight className="mx-1 size-4 text-muted-foreground/50" />
                      )}

                      <Stepper.Item step={step.id}>
                        <Stepper.Trigger className="mono-micro flex items-center gap-2 rounded-full border border-border bg-background px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted data-[status=active]:border-primary data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:ring-1 data-[status=active]:ring-primary/20">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {index + 1}
                          </span>
                          <Stepper.Title className="max-w-[20ch] truncate font-bold" />
                        </Stepper.Trigger>
                      </Stepper.Item>
                    </Fragment>
                  )}
                </Stepper.Items>
              </Stepper.List>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <GuideDetails
                  Stepper={Stepper}
                  guideContData={guideContData}
                  setGuideContData={setGuideContData}
                  subjects={subjectOptions}
                  guides={guideOptions}
                  onSaveDraft={saveDraft}
                  submitting={submitting}
                  showBaseFields={false}
                  title="Edit Details"
                  changeSummary={changeSummary}
                  onChangeSummaryChange={setChangeSummary}
                />

                <Content
                  Stepper={Stepper}
                  body={guideContData.body}
                  onBodyChange={(body) =>
                    setGuideContData((prev) => ({ ...prev, body }))
                  }
                  onUploadImage={uploadGuideImage}
                  onSaveDraft={saveDraft}
                  submitting={submitting}
                  title="Edit Content"
                />

                <Submit
                  Stepper={Stepper}
                  guide={previewGuide}
                  guideType={guideType}
                  onSaveDraft={saveDraft}
                  onPublish={publish}
                  submitting={submitting}
                  title="Preview"
                  publishLabel="Submit Guide Revision"
                />
              </div>
            </>
          )}
        </Stepper.Root>
      </section>
    </div>
  );
}
