import React, { useEffect, useRef, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { lexical } from "@mdxeditor/editor";
import katex from "katex";
import { $isMathNode } from "./MathNode";
import { MathFieldAdapter } from "./MathFieldAdapter";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
} = lexical;

interface MathViewProps {
  nodeKey: string;
  equation: string;
  inline: boolean;
}

// Helper to determine if an event target is associated with MathLive/CortexJS elements (including scrims, keyboard panels, menus)
const isTargetMathLive = (target: any): boolean => {
  if (!target) return false;

  let path: Array<any> = [];
  if (target instanceof Event || (target.target && target.composedPath)) {
    path = target.composedPath();
  } else {
    let current = target;
    while (current) {
      path.push(current);
      current =
        current.parentElement ||
        (current.getRootNode && typeof current.getRootNode === "function"
          ? current.getRootNode().host
          : null);
    }
  }

  for (const node of path) {
    if (node && (node.nodeType === 1 || node instanceof HTMLElement)) {
      const tagName = (node.tagName || "").toLowerCase();
      if (
        tagName === "math-field" ||
        tagName.includes("math") ||
        tagName.includes("cortexjs")
      ) {
        return true;
      }
      if (
        node.id &&
        (node.id.includes("cortexjs") || node.id.includes("mathlive"))
      ) {
        return true;
      }
      const classes = Array.from(node.classList || []);
      if (
        classes.some(
          (c: any) =>
            c.startsWith("ML__") ||
            c.startsWith("MLK__") ||
            c.includes("mathfield") ||
            c.includes("cortexjs") ||
            c.includes("mathlive") ||
            c.includes("ui-menu")
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

// Helper to render static equation HTML using KaTeX
const renderKatex = (equation: string, inline: boolean) => {
  try {
    return katex.renderToString(equation, {
      displayMode: !inline,
      throwOnError: false,
    });
  } catch (error) {
    console.error("KaTeX error:", error);
    return `<span class="text-destructive font-mono text-xs">${equation}</span>`;
  }
};

// Inner helper component to manage focus and keyboard actions inside the popover
function MathPopoverEditor({
  equation,
  onChange,
  onClose,
}: {
  equation: string;
  onChange: (val: string) => void;
  onClose: () => void;
}) {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    // Focus the math-field input when the editor mounts in the popover
    const timeoutId = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }, 150);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div onKeyDown={handleKeyDown} className="w-full">
      <MathFieldAdapter
        ref={editorRef}
        value={equation}
        onChange={onChange}
        readOnly={false}
        style={{
          width: "100%",
          display: "block",
          minWidth: "16rem",
        }}
      />
    </div>
  );
}

export function MathView({ nodeKey, equation, inline }: MathViewProps) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected] = useLexicalNodeSelection(nodeKey);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);

  // Synchronize popover open state with Lexical node selection
  useEffect(() => {
    setIsOpen(isSelected);
  }, [isSelected]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setSelected(open);
    if (!open) {
      // Clear Node selection in Lexical to return focus to the text flow
      editor.update(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          selection.clear();
        }
      });
      // Force editor focus back to text cursor
      editor.getRootElement()?.focus();
    }
  };

  const handleDelete = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node !== null) {
        node.remove();
      }
    });
  };

  // Listen for delete/backspace/enter commands when the node is selected in Lexical
  useEffect(() => {
    const handleDeleteCommand = (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        event.preventDefault();
        handleDelete();
        return true;
      }
      return false;
    };

    const handleEnterCommand = (event: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection()) && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
        return true;
      }
      return false;
    };

    const unregisterDelete = editor.registerCommand(
      KEY_DELETE_COMMAND,
      handleDeleteCommand,
      COMMAND_PRIORITY_LOW
    );
    const unregisterBackspace = editor.registerCommand(
      KEY_BACKSPACE_COMMAND,
      handleDeleteCommand,
      COMMAND_PRIORITY_LOW
    );
    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      handleEnterCommand,
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterDelete();
      unregisterBackspace();
      unregisterEnter();
    };
  }, [editor, nodeKey, isSelected, isOpen]);

  const handleInputChange = (newValue: string) => {
    console.log("[Diagnostic] handleInputChange. newValue:", newValue);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isMathNode(node)) {
        console.log("[Diagnostic] MathNode setEquation to:", newValue);
        node.setEquation(newValue);
      } else {
        console.warn("[Diagnostic] MathNode not found for key:", nodeKey);
      }
    });
  };

  // Render inline math block
  if (inline) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <span
            ref={containerRef}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(true);
            }}
            className={cn(
              "group math-node relative inline-flex cursor-pointer items-center rounded-md px-1.5 py-0.5 transition-all duration-200 ease-in-out select-none",
              isSelected
                ? "bg-primary/10 ring-2 ring-primary/50 dark:bg-primary/20"
                : "bg-transparent ring-0 hover:bg-muted/40 hover:ring-1 hover:ring-border"
            )}
            style={{
              verticalAlign: "middle",
            }}
          >
            {equation === "" ? (
              <span className="font-mono text-xs font-semibold text-muted-foreground/80">
                f(x)
              </span>
            ) : (
              <span
                dangerouslySetInnerHTML={{
                  __html: renderKatex(equation, true),
                }}
                className="math-preview"
              />
            )}
          </span>
        </PopoverTrigger>

        <PopoverContent
          className="z-50 flex w-80 flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isTargetMathLive(e)) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (isTargetMathLive(e)) {
              e.preventDefault();
            }
          }}
        >
          <div className="flex items-center justify-between border-b border-border pb-1.5">
            <span className="text-xs font-semibold text-foreground">
              Edit Inline Equation
            </span>
            <button
              type="button"
              onClick={() => handleDelete()}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Delete
            </button>
          </div>
          <div className="flex w-full items-center rounded-md border border-border border-input bg-background/50 px-2 py-1.5 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring">
            <MathPopoverEditor
              equation={equation}
              onChange={handleInputChange}
              onClose={() => handleOpenChange(false)}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Press Enter to save</span>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="rounded border border-border bg-muted px-2 py-0.5 font-semibold text-foreground hover:bg-muted/80"
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Render block math block
  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setSelected(true);
          }}
          className={cn(
            "math-node relative mx-auto my-3 block w-fit max-w-full cursor-pointer rounded-lg text-center transition-all duration-200 ease-in-out select-none",
            isSelected
              ? "bg-primary/5 px-10 py-5 ring-2 ring-primary/40 dark:bg-primary/10"
              : equation === ""
                ? "border border-dashed border-border bg-muted/40 px-8 py-3.5 hover:border-muted-foreground/30 hover:bg-muted/80"
                : "bg-transparent px-6 py-3 ring-0 hover:bg-muted/30 hover:ring-1 hover:ring-border"
          )}
        >
          {equation === "" ? (
            <div className="flex items-center justify-center gap-2.5 py-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-primary/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 7H7l4 5-4 5h10"
                />
              </svg>
              <span className="font-sans text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase">
                Insert block equation
              </span>
            </div>
          ) : (
            <div
              dangerouslySetInnerHTML={{ __html: renderKatex(equation, false) }}
              className="math-preview mx-auto"
            />
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="z-50 flex w-96 flex-col gap-2.5 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        align="center"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (isTargetMathLive(e)) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          if (isTargetMathLive(e)) {
            e.preventDefault();
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <span className="text-xs font-semibold text-foreground">
            Edit Block Equation
          </span>
          <button
            type="button"
            onClick={() => handleDelete()}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Delete
          </button>
        </div>
        <div className="flex w-full items-center rounded-md border border-border border-input bg-background/50 px-2 py-1.5 text-sm shadow-xs focus-within:ring-1 focus-within:ring-ring">
          <MathPopoverEditor
            equation={equation}
            onChange={handleInputChange}
            onClose={() => handleOpenChange(false)}
          />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Press Enter to save</span>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded border border-border bg-muted px-2 py-0.5 font-semibold text-foreground hover:bg-muted/80"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
