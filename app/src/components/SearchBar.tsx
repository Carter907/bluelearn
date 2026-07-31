import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  // Defaults to clearing the field; browse also clears the URL query.
  onClear?: () => void;
  placeholder?: string;
  // Optional control rendered between the input and the Search button, e.g.
  // /browse's collection filter. Omitted on pages that don't filter.
  filter?: React.ReactNode;
};

// The large search bar shared by the home page and /browse. The only thing
// that differs between them is what onSubmit does, so that's a prop.
export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search guides, objectives...",
  filter,
}: Props) {
  return (
    <form
      className="flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative flex-1 rounded-md">
        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-14 pr-12 pl-11 text-base"
        />

        {value && (
          <button
            type="button"
            onClick={() => (onClear ? onClear() : onChange(""))}
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filter}

      <Button type="submit" className="btn-pri h-14 px-8">
        Search
      </Button>
    </form>
  );
}
