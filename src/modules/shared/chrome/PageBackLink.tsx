import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export const PageBackLink = ({
  to,
  label = "Back",
  onClick,
  className,
}: {
  to?: string;
  label?: string;
  onClick?: () => void;
  className?: string;
}) => {
  if (onClick && !to) {
    return (
      <IconButton
        className={cn("shrink-0", className)}
        onClick={onClick}
        aria-label={label}
      >
        <ArrowLeft className="size-4" />
      </IconButton>
    );
  }

  return (
    <IconButton
      asChild
      className={cn("shrink-0", className)}
      aria-label={label}
    >
      <Link to={to ?? ".."}>
        <ArrowLeft className="size-4" />
      </Link>
    </IconButton>
  );
};
