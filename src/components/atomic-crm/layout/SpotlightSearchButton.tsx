import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const SpotlightSearchButton = ({
  title,
  description,
  placeholder,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={title}>
        <Search className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-xl p-4">
      <DialogHeader className="text-left">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 pl-9"
        />
      </div>
    </DialogContent>
  </Dialog>
);

