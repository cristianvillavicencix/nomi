import { ExternalLink, Globe } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const ClientPortalProfileSection = () => (
  <Card>
    <CardContent className="space-y-3 pt-6">
      <div className="flex items-center gap-2">
        <Globe className="size-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-muted-foreground">
          Client portal
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Preview the client-facing portal or open a project-specific invite link
        from the globe icon next to each project title (invite is under Delivery).
      </p>
      <Button type="button" variant="outline" asChild>
        <Link to="/portal" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" />
          Open client portal
        </Link>
      </Button>
    </CardContent>
  </Card>
);
