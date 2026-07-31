import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useRef, useState } from "react";

import { CollapsibleSection } from "@/components/CollapsibleSection";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ChangeRow } from "@/components/review/ChangeRow";
import { ChangeBadge } from "@/components/review/ChangeBadge";
import { ChangeSection } from "@/components/review/ChangeSection";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

import { cn } from "@/lib/utils";
import { castDecision } from "@/lib/api/reviews";

export type Review = {
  decision: string;
  notes: string;
  reasons: Array<string>;
};

type PropTypes = {
  caseId: string;
  revision: any;
  revisionData: any;
};

export const ReviewSidebar = ({
  caseId,
  revision,
  revisionData,
}: PropTypes) => {
  const [submitting, setSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const subjects = revision?.tags ?? [];

  // Reviewers can revote while the case is open, so start from their last vote.
  const priorDecision = revisionData.viewer_decision;

  const caseOpen =
    revisionData.case.status !== "approved" &&
    revisionData.case.status !== "rejected";

  const validateReview = () => {
    if (review.decision === "")
      return "Choose approve or reject before submitting";
    if (review.decision === "approve") return "";

    const missing = [];
    if (review.reasons.length === 0) missing.push("at least one reason");
    if (review.notes.length === 0) missing.push("a note");

    return missing.length === 0
      ? ""
      : `Rejections require ${missing.join(" and ")}`;
  };

  const submitDecision = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const missingFields = validateReview();
    if (missingFields.length !== 0) {
      toast.error(missingFields);
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Submitting decision...");

    try {
      await castDecision(caseId, review, { signal: controller.signal });
      toast.success("Decision submitted", { id: toastId });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error("There was an unexpected error with your submission", {
          id: toastId,
        });
      } else {
        toast.dismiss(toastId);
      }
      setSubmitting(false);
    }
  };

  const canVote = revisionData.viewer_role === "panelist" && caseOpen;

  const [review, setReview] = useState<Review>({
    decision:
      priorDecision === null
        ? ""
        : priorDecision.decision === "approved"
          ? "approve"
          : "reject",
    notes: priorDecision?.notes ?? "",
    reasons: priorDecision?.reasons ?? [],
  });

  const REASONS = [
    { value: "hierarchy_issue", label: "Hierarchy Issues" },
    { value: "factual_error", label: "Factual Error" },
    { value: "duplicate_content", label: "Duplicate Content" },
    { value: "scope_violation", label: "Scope Violation" },
    { value: "clarity_issue", label: "Clarity Issues" },
    {
      value: "missing_required_information",
      label: "Missing Required Information",
    },
  ];

  return (
    <aside className="h-[calc(100vh-70px)] space-y-4 overflow-y-auto border-r px-6 py-6">
      {canVote && (
        <CollapsibleSection
          defaultOpen={true}
          title={<p className="ml-auto">Review Decision</p>}
        >
          <section className="space-y-4">
            <FieldGroup>
              <Field className="space-y-4">
                <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                  Vote
                </FieldLabel>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 border-red-500/40 font-mono text-xs font-bold text-red-600 uppercase transition-colors hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
                      review.decision == "reject" && "bg-red-500/10"
                    )}
                    onClick={() => {
                      if (review.decision == "reject") {
                        setReview((prev) => ({
                          ...prev,
                          decision: "",
                        }));
                      } else {
                        setReview((prev) => ({
                          ...prev,
                          decision: "reject",
                        }));
                      }
                    }}
                  >
                    <X />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 border-green-600/40 font-mono text-xs font-bold text-green-700 uppercase transition-colors hover:bg-green-600/10 hover:text-green-700 dark:text-green-400 dark:hover:text-green-400",
                      review.decision == "approve" && "bg-green-600/10"
                    )}
                    onClick={() => {
                      if (review.decision == "approve") {
                        setReview((prev) => ({
                          ...prev,
                          decision: "",
                        }));
                      } else {
                        setReview((prev) => ({
                          ...prev,
                          decision: "approve",
                        }));
                      }
                    }}
                  >
                    <Check />
                    Approve
                  </Button>
                </div>
              </Field>
            </FieldGroup>

            <FieldGroup className="gap-4">
              <Field className="space-y-2">
                <FieldLabel className="font-mono tracking-[0.08em] uppercase">
                  Notes
                </FieldLabel>

                <textarea
                  className="h-32 w-full min-w-0 resize-none rounded-md border border-input bg-input/20 p-2 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-xs/relaxed dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  rows={4}
                  placeholder="Add notes to explain your decision..."
                  required
                  value={review.notes}
                  onChange={(e) =>
                    setReview((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </Field>

              {review.decision == "reject" && (
                <Field className="space-y-2">
                  <FieldLabel className="font-mono font-bold tracking-[0.08em] uppercase">
                    Reasons
                  </FieldLabel>

                  <Combobox
                    multiple
                    items={REASONS}
                    value={review.reasons}
                    onValueChange={(reasons) =>
                      setReview((prev) => ({
                        ...prev,
                        reasons,
                      }))
                    }
                  />
                </Field>
              )}
            </FieldGroup>

            <Button
              className="btn-pri w-full py-2.5"
              size="lg"
              disabled={submitting}
              onClick={() => {
                submitDecision();
              }}
            >
              Submit Decision
            </Button>
          </section>
        </CollapsibleSection>
      )}

      <section className="space-y-2">
        <CollapsibleSection
          defaultOpen={true}
          title={<p className="ml-auto">Proposed Subjects</p>}
        >
          <ChangeSection count={subjects.length} empty="None proposed.">
            {subjects.map((s: { id: string; name: string; status: string }) => (
              <ChangeRow
                key={s.id}
                label={s.name}
                badge={
                  s.status === "draft" ? (
                    <ChangeBadge tone="new">New</ChangeBadge>
                  ) : (
                    <ChangeBadge tone="existing">Existing</ChangeBadge>
                  )
                }
              />
            ))}
          </ChangeSection>
        </CollapsibleSection>

        <CollapsibleSection
          defaultOpen={true}
          title={<p className="ml-auto">Prerequisite Guides</p>}
        >
          <ChangeSection
            count={revisionData.prerequisites.length}
            empty="None declared."
          >
            {revisionData.prerequisites.map(
              (p: { slug: string; title?: string }) => (
                <ChangeRow
                  key={p.slug}
                  label={p.title ?? p.slug}
                  badge={<ChangeBadge tone="existing">Existing</ChangeBadge>}
                />
              )
            )}

            {revisionData.todos.map((t: { id: string; title: string }) => (
              <ChangeRow
                key={t.id}
                label={t.title}
                badge={<ChangeBadge tone="new">To Do</ChangeBadge>}
              />
            ))}
          </ChangeSection>
        </CollapsibleSection>
      </section>
    </aside>
  );
};
