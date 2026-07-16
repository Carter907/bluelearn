import { StepperActionHeader } from "@/components/contribute/StepperActionHeader";
import { Button } from "@/components/ui/button";

type PropTypes = {
  Stepper: any;
  submitting: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
};

export const Submit = ({
  Stepper,
  submitting,
  onSaveDraft,
  onPublish,
}: PropTypes) => {
  return (
    <Stepper.Content step="submit">
      <StepperActionHeader title={"Submit"} Stepper={Stepper} />

      <div className="flex items-center justify-end gap-4">
        <Button
          variant="ghost"
          className="btn-sec rounded-md"
          disabled={submitting}
          onClick={onSaveDraft}
        >
          Save Draft
        </Button>

        <Button
          className="btn-pri rounded-md"
          disabled={submitting}
          onClick={onPublish}
        >
          Publish
        </Button>
      </div>
    </Stepper.Content>
  );
};
