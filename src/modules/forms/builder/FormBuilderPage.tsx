import { useParams } from "react-router";
import { useGetOne } from "ra-core";
import { Loader2 } from "lucide-react";
import type { FormInstance } from "@/modules/forms/types";
import { FormBuilderProvider } from "@/modules/forms/builder/FormBuilderContext";
import { FormBuilderHeader } from "@/modules/forms/builder/FormBuilderHeader";
import { FormBuilderWorkspace } from "@/modules/forms/builder/FormBuilderWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";

export const FormBuilderPage = () => {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const {
    data: formInstance,
    isPending,
    error,
  } = useGetOne<FormInstance>(
    "form_instances",
    { id: id as string },
    { enabled: id != null },
  );

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading form builder…
      </div>
    );
  }

  if (error || !formInstance) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Form not found or you don&apos;t have access.
      </div>
    );
  }

  return (
    <FormBuilderProvider initialInstance={formInstance}>
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        <FormBuilderHeader />
        <FormBuilderWorkspace layout={isMobile ? "mobile" : "desktop"} />
      </div>
    </FormBuilderProvider>
  );
};
