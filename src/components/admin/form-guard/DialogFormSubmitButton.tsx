import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type DialogFormSubmitButtonProps = ComponentProps<typeof Button> & {
  /** Must match the `id` on the surrounding ra-core `<Form>`. */
  formId: string;
};

/**
 * Submit button for forms rendered inside a Radix Dialog portal.
 * DialogContent is portaled outside the DOM `<form>`, so a normal type="submit"
 * button does nothing unless linked via the HTML `form` attribute.
 */
export const DialogFormSubmitButton = ({
  formId,
  type = "submit",
  ...props
}: DialogFormSubmitButtonProps) => (
  <Button type={type} form={formId} {...props} />
);
