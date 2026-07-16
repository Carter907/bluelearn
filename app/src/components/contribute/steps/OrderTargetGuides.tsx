import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { FieldGroup } from "@/components/ui/field";
import guidesData from "@/data/guides.json";

const guidesMap = new Map(guidesData.map((g) => [g.slug, g]));

type PropTypes = {
  Stepper: any;
  objectiveContData: ObjectiveContribution;
  setObjectiveContData: Dispatch<SetStateAction<ObjectiveContribution>>;
};

export const OrderTargetGuides = ({
  Stepper,
  objectiveContData,
  setObjectiveContData,
}: PropTypes) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draggedIndexRef = useRef<number | null>(null);

  const targets = objectiveContData.targets;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const currentDragged = draggedIndexRef.current;
    if (currentDragged === null || currentDragged === index) return;

    const newTargets = [...targets];
    const draggedItem = newTargets[currentDragged];
    if (!draggedItem) return;
    newTargets.splice(currentDragged, 1);
    newTargets.splice(index, 0, draggedItem);

    setObjectiveContData((prev) => ({ ...prev, targets: newTargets }));

    draggedIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    draggedIndexRef.current = null;
    setDraggedIndex(null);
  };

  return (
    <Stepper.Content step="target-ordering">
      <StepperActionHeader title={"Order Target Guides"} Stepper={Stepper} />

      <FieldGroup className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Drag and drop to specify the order in which these target guides should
          be completed.
        </p>

        <div className="space-y-3">
          {targets.map((slug, index) => {
            const guide = guidesMap.get(slug);
            if (!guide) return null;

            const isDragging = index === draggedIndex;

            return (
              <div
                key={slug}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative flex items-center justify-between gap-3 rounded-lg border p-3 pl-12 shadow-sm transition-all duration-150 select-none ${
                  isDragging
                    ? "z-10 scale-[1.02] cursor-grabbing border-2 border-dashed border-primary bg-primary/10 opacity-80 ring-4 ring-primary/20"
                    : "cursor-grab border-border bg-background hover:border-primary/30"
                }`}
              >
                <div className="absolute inset-y-0 left-0 z-10 w-9 rounded-l-lg border-r border-border/70 bg-muted/40">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab text-muted-foreground/60 hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <h4 className="truncate text-sm font-medium text-foreground">
                        {guide.title}
                      </h4>
                    </div>
                    <p className="mt-1.5 ml-8 text-xs text-muted-foreground">
                      {guide.summary}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FieldGroup>
    </Stepper.Content>
  );
};
