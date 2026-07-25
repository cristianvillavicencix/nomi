import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MarketingCampaignsPlaceholderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
};

export const MarketingCampaignsPlaceholder = ({
  icon: Icon,
  title,
  description,
  bullets,
}: MarketingCampaignsPlaceholderProps) => (
  <Card className="border-dashed shadow-none">
    <CardContent className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        {description}
      </p>
      <ul className="mt-6 max-w-md space-y-2 text-left text-sm text-muted-foreground">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="text-foreground">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
