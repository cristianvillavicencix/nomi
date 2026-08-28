import type { ReactNode } from "react";
import { ArrowRight, PanelRightClose } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

type ProfilePreviewChromeProps = {
  title: string;
  onClose: () => void;
  fullViewPath?: string;
  fullViewLabel?: string;
  trailing?: ReactNode;
};

/** Shared drawer header: close, title, optional actions, primary full-view CTA. */
export const ProfilePreviewChrome = ({
  title,
  onClose,
  fullViewPath,
  fullViewLabel = "View full details",
  trailing,
}: ProfilePreviewChromeProps) => (
  <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
    <div className="flex min-w-0 items-center gap-1.5">
      <IconButton
        className="shrink-0"
        onClick={onClose}
        aria-label="Close preview"
      >
        <PanelRightClose className="size-4" />
      </IconButton>
      <p className="truncate text-base font-semibold">{title}</p>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {trailing}
      {fullViewPath ? (
        <Button
          variant="primary"
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          asChild
        >
          <Link to={fullViewPath}>
            {fullViewLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  </div>
);
