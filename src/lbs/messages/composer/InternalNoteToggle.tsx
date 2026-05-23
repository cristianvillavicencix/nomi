import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const InternalNoteToggle = ({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <label className="flex items-center gap-2 text-xs text-muted-foreground">
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      disabled={disabled}
    />
    <Label className="cursor-pointer font-normal">
      Internal note — client cannot see this
    </Label>
  </label>
);
