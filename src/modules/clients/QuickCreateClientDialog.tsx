import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  type Identifier,
} from "ra-core";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  FloatingFieldShell,
  floatingFieldControlClassName,
} from "@/components/ui/floating-field";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildQuickClientUpsertInput,
  type LbsClientUpsertResult,
  type QuickCreateClientInput,
} from "@/modules/clients/lbsClientUpsert";

export type QuickCreateClientDefaults = {
  businessName?: string;
  contactName?: string;
};

type QuickCreateClientDialogProps = {
  open: boolean;
  defaults?: QuickCreateClientDefaults;
  onClose: () => void;
  onCreated: (
    result: LbsClientUpsertResult,
    values: QuickCreateClientInput,
  ) => void;
};

const emptyValues = (): QuickCreateClientInput => ({
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
});

export const QuickCreateClientDialog = ({
  open,
  defaults,
  onClose,
  onCreated,
}: QuickCreateClientDialogProps) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<QuickCreateClientInput>(emptyValues());
  const [businessNameFocused, setBusinessNameFocused] = useState(false);
  const [contactNameFocused, setContactNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({
      ...emptyValues(),
      businessName: defaults?.businessName?.trim() ?? "",
      contactName: defaults?.contactName?.trim() ?? "",
    });
  }, [defaults?.businessName, defaults?.contactName, open]);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!identity?.id) {
        throw new Error("You must be signed in to create a client");
      }
      if (!values.businessName.trim() || !values.contactName.trim()) {
        throw new Error("Business name and contact name are required");
      }
      if (!("upsertLbsClient" in dataProvider)) {
        throw new Error("Client creation is not available in this environment");
      }
      return dataProvider.upsertLbsClient(
        buildQuickClientUpsertInput(values, identity.id),
      );
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contacts_summary"] }),
        queryClient.invalidateQueries({ queryKey: ["contacts"] }),
        queryClient.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      notify("Client created");
      onCreated(result, values);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to create client", { type: "error" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new client</DialogTitle>
          <DialogDescription>
            Add the business and main contact now. You can complete the full
            profile later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <FloatingFieldShell
            active={
              businessNameFocused || Boolean(values.businessName.trim())
            }
            label="Business name"
            htmlFor="quick-business-name"
            required
          >
            <Input
              id="quick-business-name"
              value={values.businessName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  businessName: event.target.value,
                }))
              }
              onFocus={() => setBusinessNameFocused(true)}
              onBlur={() => setBusinessNameFocused(false)}
              className={floatingFieldControlClassName}
              autoFocus
            />
          </FloatingFieldShell>
          <FloatingFieldShell
            active={contactNameFocused || Boolean(values.contactName.trim())}
            label="Contact full name"
            htmlFor="quick-contact-name"
            required
          >
            <Input
              id="quick-contact-name"
              value={values.contactName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
              onFocus={() => setContactNameFocused(true)}
              onBlur={() => setContactNameFocused(false)}
              className={floatingFieldControlClassName}
            />
          </FloatingFieldShell>
          <div className="grid gap-4 sm:grid-cols-2">
            <FloatingFieldShell
              active={emailFocused || Boolean(values.email?.trim())}
              label="Email"
              htmlFor="quick-email"
            >
              <Input
                id="quick-email"
                type="email"
                value={values.email ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                className={floatingFieldControlClassName}
              />
            </FloatingFieldShell>
            <FloatingFieldShell
              active={phoneFocused || Boolean(values.phone?.trim())}
              label="Phone"
              htmlFor="quick-phone"
            >
              <Input
                id="quick-phone"
                value={values.phone ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                className={floatingFieldControlClassName}
              />
            </FloatingFieldShell>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => mutate()}
            disabled={
              isPending ||
              !values.businessName.trim() ||
              !values.contactName.trim()
            }
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type QuickCreateContactRecord = {
  id: Identifier;
  first_name?: string;
  last_name?: string;
  company_name?: string;
};

export const toQuickCreateContactRecord = (
  result: LbsClientUpsertResult,
  values: QuickCreateClientInput,
): QuickCreateContactRecord => {
  const parts = values.contactName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return {
    id: result.contact_id,
    first_name: firstName,
    last_name: lastName || firstName,
    company_name: values.businessName.trim(),
  };
};
