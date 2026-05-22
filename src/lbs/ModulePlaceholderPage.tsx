import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderPageProps = {
  title: string;
  description: string;
  phase: number;
};

export const ModulePlaceholderPage = ({
  title,
  description,
  phase,
}: ModulePlaceholderPageProps) => (
  <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <ClipboardList className="size-5 text-muted-foreground" />
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">Coming in Phase {phase}</p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  </div>
);
