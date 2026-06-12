import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const internalNoteToggleId = "client-sms-internal-note";

export const InternalNoteToggle = ({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <Checkbox
      id={internalNoteToggleId}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
    />
    <Label htmlFor={internalNoteToggleId} className="cursor-pointer font-normal">
      Internal note — client cannot see this
    </Label>
  </div>
);
