import type { ReactNode } from "react";
import { Loader2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DialogFormSubmitButton } from "@/components/admin/form-guard/DialogFormSubmitButton";

export type CreateFormDialogShellProps = {
  icon: LucideIcon;
  iconTone?: "blue" | "violet" | "amber" | "slate";
  title: string;
  description: string;
  isSaving?: boolean;
  isMobile: boolean;
  onClose: () => void;
  cancelLabel?: string;
  submitLabel: string;
  submitFormId?: string;
  submitDisabled?: boolean;
  submitSlot?: ReactNode;
  footerNotice?: ReactNode;
  children: ReactNode;
};

const iconToneClass: Record<
  NonNullable<CreateFormDialogShellProps["iconTone"]>,
  string
> = {
  blue: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  slate: "bg-muted text-muted-foreground",
};

export const CreateFormDialogShell = ({
  icon: Icon,
  iconTone = "blue",
  title,
  description,
  isSaving = false,
  isMobile,
  onClose,
  cancelLabel = "Cancel",
  submitLabel,
  submitFormId,
  submitDisabled = false,
  submitSlot,
  footerNotice,
  children,
}: CreateFormDialogShellProps) => (
  <>
    <DialogHeader className="relative shrink-0 space-y-2 border-b bg-background px-5 py-4 pr-12 text-left sm:px-6 sm:pr-14">
      <div className="flex items-start gap-3 pr-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            iconToneClass[iconTone],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <DialogTitle className="text-base font-semibold leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-snug">
            {description}
          </DialogDescription>
        </div>
      </div>
      <DialogClose
        className="absolute top-3.5 right-3.5 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        disabled={isSaving}
        onClick={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </DialogHeader>

    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
      {children}
    </div>

    <DialogFooter
      className={cn(
        "shrink-0 gap-2 border-t bg-muted/30 px-5 py-4 sm:px-6",
        footerNotice ? "flex-col items-stretch" : "",
        isMobile && "flex-col-reverse sm:flex-col-reverse",
      )}
    >
      {footerNotice}
      <div
        className={cn(
          "flex gap-2",
          footerNotice ? "justify-end" : "",
          isMobile && "w-full flex-col-reverse",
        )}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isSaving}
          className={isMobile ? "w-full" : ""}
        >
          {cancelLabel}
        </Button>
        {submitSlot ? (
          <div className={isMobile ? "w-full [&_button]:w-full" : ""}>
            {submitSlot}
          </div>
        ) : submitFormId ? (
          <DialogFormSubmitButton
            formId={submitFormId}
            disabled={isSaving || submitDisabled}
            className={isMobile ? "w-full" : ""}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </DialogFormSubmitButton>
        ) : (
          <Button
            type="submit"
            disabled={isSaving || submitDisabled}
            className={isMobile ? "w-full" : ""}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </Button>
        )}
      </div>
    </DialogFooter>
  </>
);
