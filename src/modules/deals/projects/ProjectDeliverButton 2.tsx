import { useState } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { ProjectDeliverWizard } from "@/modules/deals/projects/delivery/ProjectDeliverWizard";
import { isProjectDelivered } from "@/modules/deals/projects/ProjectDeliveredStamp";
import type { LbsDeal } from "@/modules/types";

export const ProjectDeliverButton = ({ record }: { record: LbsDeal }) => {
  const canDeliver = useMemberCapability("crm.pipeline.edit");
  const [open, setOpen] = useState(false);
  const delivered = isProjectDelivered(record);

  if (!canDeliver) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={delivered ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        <Rocket className="size-4" />
        {delivered ? "Portal access" : "Deliver"}
      </Button>
      <ProjectDeliverWizard
        open={open}
        onClose={() => setOpen(false)}
        record={record}
      />
    </>
  );
};
