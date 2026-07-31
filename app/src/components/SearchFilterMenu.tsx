import { SlidersHorizontal } from "lucide-react";

import type {
  Collection,
  KnowledgeType,
  SearchFilters,
} from "@/lib/api/search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
};

// Keep the menu open on select so scope + knowledge type can be set in one go.
function RadioItem({ value, label }: { value: string; label: string }) {
  return (
    <DropdownMenuRadioItem
      value={value}
      className="text-xs"
      onSelect={(e) => e.preventDefault()}
    >
      {label}
    </DropdownMenuRadioItem>
  );
}

// Shared by the home page and /browse. Scope is single-choice; picking
// "Guides" unlocks the guide-only knowledge-type filter (see filtersToParams).
export function SearchFilterMenu({ value, onChange }: Props) {
  const active = value.scope || value.knowledgeType ? "text-brand-blue" : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-md border"
        >
          <SlidersHorizontal className={`h-4 w-4 ${active}`} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 font-mono">
        <DropdownMenuLabel className="text-xs">Show</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value.scope ?? "all"}
          onValueChange={(v) => {
            const scope = v === "all" ? undefined : (v as Collection);
            // knowledge_type only applies to guides; drop it otherwise.
            onChange({
              scope,
              knowledgeType:
                scope === "guides" ? value.knowledgeType : undefined,
            });
          }}
        >
          <RadioItem value="all" label="Everything" />
          <RadioItem value="guides" label="Guides only" />
          <RadioItem value="objectives" label="Objectives only" />
        </DropdownMenuRadioGroup>

        {value.scope === "guides" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">
              Knowledge type
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={value.knowledgeType ?? "any"}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  knowledgeType: v === "any" ? undefined : (v as KnowledgeType),
                })
              }
            >
              <RadioItem value="any" label="Any" />
              <RadioItem value="theoretical" label="Theoretical" />
              <RadioItem value="practical" label="Practical" />
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
