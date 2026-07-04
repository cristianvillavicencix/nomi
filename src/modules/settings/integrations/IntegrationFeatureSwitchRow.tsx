import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export const IntegrationFeatureSwitchRow = ({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: Props) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
    <div className="min-w-0 space-y-0.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    />
  </div>
);
