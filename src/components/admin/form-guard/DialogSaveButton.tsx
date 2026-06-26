import type { RaRecord } from "ra-core";
import { SaveButton, type SaveButtonProps } from "@/components/admin/form";

/**
 * Save button for forms inside a Radix Dialog or Sheet portal.
 * Uses type="button" so submit works even when the footer is portaled
 * outside the DOM `<form>` (via handleSubmit + FormProvider context).
 */
export const DialogSaveButton = <RecordType extends RaRecord = RaRecord>(
  props: SaveButtonProps<RecordType>,
) => <SaveButton type="button" {...props} />;
