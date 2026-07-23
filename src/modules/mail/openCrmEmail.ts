import { useCallback } from "react";
import { useMailComposeOptional } from "./mailComposeContext";
import {
  openCrmEmailWithFallback,
  type OpenCrmEmailArgs,
} from "./openCrmEmailUtils";
import { useMailComposeAvailable } from "./useMailComposeAvailable";

export type { OpenCrmEmailArgs } from "./openCrmEmailUtils";
export { openCrmEmailWithFallback } from "./openCrmEmailUtils";

export function useOpenCrmEmail() {
  const { canCompose } = useMailComposeAvailable();
  const mailCompose = useMailComposeOptional();

  return useCallback(
    (args: OpenCrmEmailArgs) => {
      openCrmEmailWithFallback(args, canCompose, mailCompose?.openCompose);
    },
    [canCompose, mailCompose],
  );
}
