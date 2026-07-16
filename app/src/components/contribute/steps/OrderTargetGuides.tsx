import { useRef, useState } from "react";
import { Calendar, Clock, GripVertical, Replace, User } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { ObjectiveContribution } from "@/types/contributions";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { FieldGroup } from "@/components/ui/field";
import guidesData from "@/data/guides.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [hoveredGuide, setHoveredGuide] = useState<string | null>(null);

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
                key={index}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`relative flex items-center justify-between gap-3 rounded-lg border p-3 pl-12 shadow-sm transition-all duration-150 select-none ${
                  isDragging
                    ? "z-10 scale-[1.02] cursor-grabbing border-2 border-dashed border-primary bg-primary/10 opacity-80 ring-4 ring-primary/20"
                    : "cursor-grab border-border bg-background hover:border-primary/30"
                } ${hoveredGuide === slug ? "border-primary/50 ring-2 ring-primary/40" : ""}`}
                onMouseEnter={() => {
                  if (draggedIndex === null) setHoveredGuide(slug);
                }}
                onMouseLeave={() => {
                  if (draggedIndex === null) setHoveredGuide(null);
                }}
              >
                {/* Left controls column positioned absolutely with background and border separation */}
                <div className="absolute inset-y-0 left-0 z-10 w-9 rounded-l-lg border-r border-border/70 bg-muted/40">
                  {/* Drag Icon completely centered vertically */}
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
                    {/* Author, Date, & Duration under title, before description */}
                    {(guide.author || guide.created_at || guide.duration) && (
                      <div className="mt-1 ml-8 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
                        {guide.author && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground/75" />
                            @{guide.author}
                          </span>
                        )}
                        {guide.created_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground/75" />
                            {guide.created_at}
                          </span>
                        )}
                        {guide.duration && (
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-3 w-3 text-muted-foreground/75" />
                            {guide.duration}m
                          </span>
                        )}
                      </div>
                    )}
                    <p className="mt-1.5 ml-8 text-xs text-muted-foreground">
                      {guide.summary}
                    </p>
                    {/* Tags below description */}
                    {guide.tags.length > 0 && (
                      <div className="mt-2 ml-8 flex flex-wrap gap-1">
                        {guide.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Swap Variant (bottom-right) */}
                <div className="flex shrink-0 flex-col items-center justify-between gap-3 self-stretch">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    className="h-8 w-8 cursor-not-allowed border-none p-0 text-muted-foreground/40 hover:bg-transparent"
                    title="Variants Coming Soon"
                  >
                    <Replace className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </FieldGroup>
    </Stepper.Content>
  );
};
