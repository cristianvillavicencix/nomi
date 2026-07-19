import { useResourceContext, useCreatePath } from "ra-core";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

export const MobileBackButton = (props: { resource?: string; to?: string }) => {
  const resource = useResourceContext(props);
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const { to } = props;
  const finalTo =
    to ??
    createPath({
      resource,
      type: "list",
    });
  const backLabel = to ? "Back" : "Back to list";

  return (
    <IconButton
      className="size-5 rounded-full pr-2"
      aria-label={backLabel}
      onClick={(e) => {
        e.preventDefault();
        navigate(finalTo);
      }}
    >
      <ChevronLeft className="size-6" />
      <span className="sr-only">{backLabel}</span>
    </IconButton>
  );
};
