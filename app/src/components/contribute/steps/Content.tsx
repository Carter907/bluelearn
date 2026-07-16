import { Suspense, lazy, useEffect, useState } from "react";
import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";

const Editor = lazy(() => import("../editor/Editor"));

type PropTypes = {
  Stepper: any;
  body: string;
  onBodyChange: (body: string) => void;
};

export const Content = ({ Stepper, body, onBodyChange }: PropTypes) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Stepper.Content step="content">
      <StepperActionHeader title={"Content"} Stepper={Stepper} />

      {mounted && (
        <Suspense
          fallback={
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading Editor...
            </div>
          }
        >
          <Editor value={body} onChange={onBodyChange} />
        </Suspense>
      )}
    </Stepper.Content>
  );
};
