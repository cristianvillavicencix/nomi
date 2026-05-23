import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLbsProjectStageLabel } from "@/lbs/deals/lbsProjectConstants";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

type PortalProject = {
  id: number;
  name: string;
  stage?: string;
  project_type?: string;
  expected_end_date?: string | null;
  production_url?: string | null;
  staging_url?: string | null;
};

const PORTAL_TOKEN_KEY = "lbs.client_portal.token";

const fetchPortal = async (token: string, dealId?: number) => {
  const { data, error } = await supabase.functions.invoke("client_portal", {
    body: { token, deal_id: dealId },
  });
  if (error) throw error;
  return data as {
    account?: { email?: string };
    projects?: PortalProject[];
    project?: PortalProject;
    approvals?: Array<{ id: number; title: string; status: string }>;
  };
};

export const ClientPortalPage = () => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(
    () => searchParams.get("token") ?? localStorage.getItem(PORTAL_TOKEN_KEY) ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const selectedDealId = Number(searchParams.get("project"));

  useEffect(() => {
    if (!token.trim()) return;
    localStorage.setItem(PORTAL_TOKEN_KEY, token.trim());
    setLoading(true);
    setError(null);
    void fetchPortal(token.trim(), Number.isFinite(selectedDealId) ? selectedDealId : undefined)
      .then((payload) => {
        setAccountEmail(payload.account?.email ?? null);
        if (payload.project) {
          setProjects([payload.project]);
        } else {
          setProjects(payload.projects ?? []);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load portal");
      })
      .finally(() => setLoading(false));
  }, [selectedDealId, token]);

  const headline = useMemo(
    () => (accountEmail ? `Welcome, ${accountEmail}` : "Client portal"),
    [accountEmail],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{headline}</h1>
        <p className="text-sm text-muted-foreground">
          Read-only view of your shared projects.
        </p>
      </div>

      {!token ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Open the invitation link from your project manager to access this
            portal.
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="text-lg">{project.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status: </span>
                {getLbsProjectStageLabel(project.stage)}
              </div>
              {project.expected_end_date ? (
                <div>
                  <span className="text-muted-foreground">Target date: </span>
                  {new Date(`${project.expected_end_date}T12:00:00`).toLocaleDateString()}
                </div>
              ) : null}
              {project.staging_url ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={project.staging_url} target="_blank" rel="noreferrer">
                    Open staging site
                  </a>
                </Button>
              ) : null}
              {project.production_url ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={project.production_url} target="_blank" rel="noreferrer">
                    Open live site
                  </a>
                </Button>
              ) : null}
              {!selectedDealId ? (
                <Button type="button" size="sm" variant="link" className="px-0" asChild>
                  <Link to={`/portal?token=${encodeURIComponent(token)}&project=${project.id}`}>
                    View details
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
