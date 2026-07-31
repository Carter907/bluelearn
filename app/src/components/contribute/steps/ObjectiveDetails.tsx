import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";

import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";

type SubjectOption = { id: string; name: string };
type GuideOption = {
  slug: string | null;
  title: string | null;
  summary: string | null;
};

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
  subjects: Array<SubjectOption>;
  guides: Array<GuideOption>;
  onSaveDraft?: () => void;
  submitting?: boolean;
};

export const ObjectiveDetails = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
  subjects,
  guides,
  onSaveDraft,
  submitting,
}: PropTypes) => {
  const guideItems = guides
    .filter((g): g is GuideOption & { slug: string } => !!g.slug)
    .map((g) => {
      return {
        value: g.slug,
        label: g.title ?? g.slug,
        description: g.summary ?? undefined,
      };
    });

  const targs = useMemo(
    () =>
      guideItems.filter((item) =>
        objectiveContData.targets.includes(item.value)
      ),
    [guideItems, objectiveContData.targets]
  );

  return (
    <Stepper.Content step="objective-details">
      <StepperActionHeader
        title={"Objective Details"}
        Stepper={Stepper}
        onSaveDraft={onSaveDraft}
        submitting={submitting}
      />

      <FieldGroup>
        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Title
            </FieldLabel>
            <FieldDescription className="text-xs">
              A clear, concise name for this learning objective.
            </FieldDescription>
          </div>

          <Input
            id="title"
            type="text"
            autoComplete="Title"
            maxLength={50}
            placeholder="Choose a title. (Maximum 50 characters)."
            className="h-10 rounded-md"
            required
            value={objectiveContData.title}
            onChange={(e) =>
              setObjectiveContData((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Summary
            </FieldLabel>
            <FieldDescription className="text-xs">
              Briefly describe what the learner will achieve by completing this
              objective.
            </FieldDescription>
          </div>

          <Textarea
            className="h-32 w-full min-w-0 resize-none"
            rows={4}
            maxLength={250}
            placeholder="Write a summary for the objective."
            required
            value={objectiveContData.summary}
            onChange={(e) =>
              setObjectiveContData((prev) => ({
                ...prev,
                summary: e.target.value,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Subjects
            </FieldLabel>
            <FieldDescription className="text-xs">
              Select existing subjects for this learning objective.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            items={subjects.map((s) => {
              return {
                value: s.id,
                label: s.name,
              };
            })}
            value={objectiveContData.subjects}
            onValueChange={(ids) =>
              setObjectiveContData((prev) => ({
                ...prev,
                subjects: ids,
              }))
            }
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Target Guides
            </FieldLabel>
            <FieldDescription className="text-xs">
              Select the guides you think would be appropriate for this learning
              objective.
            </FieldDescription>
          </div>

          <Combobox
            multiple
            items={guideItems}
            value={objectiveContData.targets}
            onValueChange={(targets) => {
              setObjectiveContData((prev) => {
                const featuredSubObjective = targets.includes(
                  prev.featuredSubObjective
                )
                  ? prev.featuredSubObjective
                  : "";
                const subObjectives = prev.subObjectives.filter((sub) =>
                  targets.includes(sub.targetSlug)
                );
                return {
                  ...prev,
                  targets,
                  featuredSubObjective,
                  subObjectives,
                };
              });
            }}
          />
        </Field>

        <Field className="space-y-2">
          <div className="space-y-1">
            <FieldLabel required className="mono-micro">
              Featured Sub-Objective
            </FieldLabel>
            <FieldDescription className="text-xs">
              {targs.length === 0
                ? "Select at least one Target Guide above first."
                : "The primary target guide to showcase on the objective card."}
            </FieldDescription>
          </div>

          <Combobox
            disabled={targs.length === 0}
            items={targs}
            value={objectiveContData.featuredSubObjective}
            onValueChange={(featuredSubObjective) =>
              setObjectiveContData((prev) => ({
                ...prev,
                featuredSubObjective,
              }))
            }
          />
        </Field>
      </FieldGroup>
    </Stepper.Content>
  );
};
