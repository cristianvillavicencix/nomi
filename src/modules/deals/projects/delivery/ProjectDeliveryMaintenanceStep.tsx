import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  computeAutoMaintenanceReviewDate,
  formatMaintenanceReviewLabel,
  type MaintenanceScheduleMode,
} from "@/modules/deals/projects/delivery/projectMaintenanceReview";

type ProjectDeliveryMaintenanceStepProps = {
  mode: MaintenanceScheduleMode;
  onModeChange: (mode: MaintenanceScheduleMode) => void;
  freeMonths: number;
  onFreeMonthsChange: (months: number) => void;
  manualDate: string;
  onManualDateChange: (date: string) => void;
};

export const ProjectDeliveryMaintenanceStep = ({
  mode,
  onModeChange,
  freeMonths,
  onFreeMonthsChange,
  manualDate,
  onManualDateChange,
}: ProjectDeliveryMaintenanceStepProps) => {
  const autoDate = computeAutoMaintenanceReviewDate(freeMonths);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Next web review & maintenance</h3>
        <p className="text-sm text-muted-foreground">
          Schedule when the team should follow up with the client after
          delivery.
        </p>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(value) =>
          onModeChange(value as MaintenanceScheduleMode)
        }
        className="space-y-3"
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem value="auto" className="mt-0.5" />
          <div className="space-y-2">
            <div className="text-sm font-medium">Automatic</div>
            <p className="text-xs text-muted-foreground">
              Based on free maintenance months from the delivery plan.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={24}
                className="w-20"
                value={freeMonths}
                onChange={(event) =>
                  onFreeMonthsChange(Number(event.target.value) || 3)
                }
                disabled={mode !== "auto"}
              />
              <span className="text-sm text-muted-foreground">months →</span>
              <span className="text-sm font-medium">
                {formatMaintenanceReviewLabel(autoDate)}
              </span>
            </div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
          <RadioGroupItem value="manual" className="mt-0.5" />
          <div className="space-y-2">
            <div className="text-sm font-medium">Manual date</div>
            <p className="text-xs text-muted-foreground">
              Pick a specific review date for this project.
            </p>
            <div className="space-y-1">
              <Label htmlFor="maintenance-review-date" className="sr-only">
                Review date
              </Label>
              <Input
                id="maintenance-review-date"
                type="date"
                value={manualDate}
                onChange={(event) => onManualDateChange(event.target.value)}
                disabled={mode !== "manual"}
              />
            </div>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
};
