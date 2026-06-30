import { Combobox } from "@/components/ui/combobox"
import { useState } from "react";

type PropTypes = {
  id: string;
  items: Array<string>;
}

export function ComboboxSingle({ items }: PropTypes) {
  const [value, setValue] = useState<string>("");

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={setValue}
    />
  )
}