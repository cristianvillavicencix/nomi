import {
  CreateBase,
  Form,
  useGetIdentity,
  useNotify,
  useRefresh,
  useRecordContext,
  useUpdate,
  type Identifier,
  type RaRecord,
} from "ra-core";
import { useFormContext } from "react-hook-form";
import { SaveButton } from "@/components/admin/form";
import { cn } from "@/lib/utils";

import { NoteInputs } from "./NoteInputs";
import { getCurrentDate } from "./utils";
import { foreignKeyMapping } from "./foreignKeyMapping";

export const NoteCreate = ({
  reference,
  showStatus,
  className,
  contactId,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
  className?: string;
  contactId?: Identifier;
}) => {
  const record = useRecordContext();
  const { identity } = useGetIdentity();
  const resource = reference === "contacts" ? "contact_notes" : "deal_notes";
  const referenceRecordId =
    reference === "contacts" ? contactId ?? record?.id : record?.id;

  if (!referenceRecordId || !identity) return null;

  return (
    <CreateBase resource={resource} redirect={false}>
      <Form>
        <div className={cn("space-y-3", className)}>
          <NoteInputs showStatus={showStatus} />
          <NoteCreateButton
            reference={reference}
            record={record}
            contactId={reference === "contacts" ? referenceRecordId : undefined}
            referenceRecordId={referenceRecordId}
          />
        </div>
      </Form>
    </CreateBase>
  );
};

const NoteCreateButton = ({
  reference,
  record,
  contactId,
  referenceRecordId,
}: {
  reference: "contacts" | "deals";
  record?: RaRecord<Identifier>;
  contactId?: Identifier;
  referenceRecordId: Identifier;
}) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { reset } = useFormContext();

  if (!identity) return null;

  const resetValues: {
    date: string;
    text: null;
    attachments: null;
    status?: string;
  } = {
    date: getCurrentDate(),
    text: null,
    attachments: null,
  };

  if (reference === "contacts") {
    resetValues.status = "warm";
  }

  const handleSuccess = (data: any) => {
    reset(resetValues, { keepValues: false });
    refresh();
    if (reference === "contacts" && record) {
      update(reference, {
        id: record.id as unknown as Identifier,
        data: {
          last_seen: new Date().toISOString(),
          status: data.status,
        },
        previousData: record,
      });
    }
    notify("Note added");
  };

  return (
    <div className="flex justify-end">
      <SaveButton
        type="button"
        label="Add this note"
        transform={(data) => ({
          ...data,
          [foreignKeyMapping[reference]]:
            reference === "contacts" ? contactId : referenceRecordId,
          contact_id: reference === "contacts" ? contactId : data.contact_id,
          organization_member_id: identity.id,
          date: new Date(data.date || getCurrentDate()).toISOString(),
        })}
        mutationOptions={{
          onSuccess: handleSuccess,
        }}
      >
        Add this note
      </SaveButton>
    </div>
  );
};
