import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
] as const;

export const ActiveCallKeypad = ({
  onDigit,
  className,
}: {
  onDigit: (digit: string) => void;
  className?: string;
}) => (
  <div className={cn("grid grid-cols-3 gap-1.5 p-2", className)}>
    {KEYS.flat().map((digit) => (
      <Button
        key={digit}
        type="button"
        variant="secondary"
        size="sm"
        aria-label={`Dial ${digit}`}
        className="h-10 text-base font-semibold tabular-nums"
        onClick={() => onDigit(digit)}
      >
        {digit}
      </Button>
    ))}
  </div>
);
