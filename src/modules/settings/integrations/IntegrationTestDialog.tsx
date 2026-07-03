import { useMutation } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder: string;
  inputType?: "tel" | "email";
  onSend: (value: string) => Promise<void>;
};

export const IntegrationTestDialog = ({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  inputType = "tel",
  onSend,
}: Props) => {
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: () => onSend(value.trim()),
    onSuccess: () => {
      onOpenChange(false);
      setValue("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="integration-test-input">{label}</Label>
          <Input
            id="integration-test-input"
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!value.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
