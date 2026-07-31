import { Calendar, Clock, GripVertical, Lock, User } from "lucide-react";
import type { Guide } from "@/types/guides";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/guideUtils";

type DraggableGuideCardProps = {
  guide: Guide;
  index: number;
  isDragging: boolean;
  isHovered?: boolean;
  isBlocking?: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: React.ReactNode;
};

export const DraggableGuideCard = ({
  guide,
  index,
  isDragging,
  isHovered,
  isBlocking,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
  children,
}: DraggableGuideCardProps) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative flex items-center justify-between gap-3 rounded-lg border p-3 pl-12 shadow-sm transition-all duration-150 select-none ${
        isDragging
          ? "z-10 scale-[1.02] cursor-grabbing border-2 border-dashed border-primary bg-primary/10 opacity-80 ring-4 ring-primary/20"
          : isBlocking
            ? "cursor-grab border-dashed border-destructive/60 bg-destructive/5"
            : `cursor-grab border-border bg-background hover:border-primary/50 hover:ring-2 hover:ring-primary/40 ${isHovered ? "border-primary/50 ring-2 ring-primary/40" : ""}`
      }`}
      title={
        isBlocking
          ? "Direct prerequisite link: the dragged guide can't cross this one"
          : undefined
      }
    >
      {/* Left controls column positioned absolutely with background and border separation */}
      <div
        className={`absolute inset-y-0 left-0 z-10 w-9 rounded-l-lg border-r ${
          isBlocking
            ? "border-destructive/40 bg-destructive/10"
            : "border-border/70 bg-muted/40"
        }`}
      >
        {/* Drag Icon completely centered vertically */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
            isBlocking
              ? "text-destructive/70"
              : "cursor-grab text-muted-foreground/60 hover:text-foreground"
          }`}
        >
          {isBlocking ? (
            <Lock className="h-4 w-4" />
          ) : (
            <GripVertical className="h-4 w-4" />
          )}
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
          {(guide.author || guide.created_at || guide.duration_minutes) && (
            <div className="mt-1 ml-7 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground/80">
              {guide.author && (
                <span className="flex items-center gap-1 font-mono uppercase">
                  <User className="h-3 w-3 text-muted-foreground/75" />@
                  {guide.author}
                </span>
              )}
              {guide.created_at && (
                <span className="flex items-center gap-1 font-mono uppercase">
                  <Calendar className="h-3 w-3 text-muted-foreground/75" />
                  {new Date(guide.created_at).toLocaleDateString()}
                </span>
              )}
              {guide.duration_minutes && (
                <span className="flex items-center gap-1 font-mono font-medium uppercase">
                  <Clock className="h-3 w-3 text-muted-foreground/75" />
                  {formatDuration(guide.duration_minutes)}
                </span>
              )}
            </div>
          )}
          <p className="mt-1.5 ml-7 text-xs text-muted-foreground">
            {guide.summary}
          </p>
          {/* Tags below description */}
          {guide.tags.length > 0 && (
            <div className="mt-2 ml-7 flex flex-wrap gap-1">
              {guide.tags.map((tag: any) => (
                <Badge
                  key={tag.slug || tag}
                  variant="outline"
                  className="mono-micro rounded-full border border-badge-border bg-badge tracking-[0.08em] text-badge-foreground"
                >
                  {tag.name || tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {children && (
        <div className="flex shrink-0 flex-col items-center justify-between gap-3 self-stretch">
          {children}
        </div>
      )}
    </div>
  );
};
