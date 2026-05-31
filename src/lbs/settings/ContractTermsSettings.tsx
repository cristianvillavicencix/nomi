import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useCreate, useGetIdentity, useGetList, useNotify, useUpdate } from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationContractTerms } from "@/lbs/types";
import {
  getDefaultContractTermsSeed,
  LBS_DEFAULT_CONTRACT_TERMS_VERSION,
} from "@/lbs/proposals/defaultContractTerms";

export const ContractTermsSettings = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [create] = useCreate();
  const [update] = useUpdate();

  const { data: termsRows = [], isPending } =
    useGetList<OrganizationContractTerms>("organization_contract_terms", {
      filter: { "is_active@eq": true },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    });

  const activeTerms = termsRows[0];
  const [version, setVersion] = useState(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
  const [title, setTitle] = useState(getDefaultContractTermsSeed().title);
  const [body, setBody] = useState(getDefaultContractTermsSeed().body_markdown);

  useEffect(() => {
    if (!activeTerms) return;
    setVersion(activeTerms.version);
    setTitle(activeTerms.title);
    setBody(activeTerms.body_markdown);
  }, [activeTerms]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (activeTerms) {
        return update(
          "organization_contract_terms",
          {
            id: activeTerms.id,
            data: {
              version: version.trim(),
              title: title.trim(),
              body_markdown: body,
            },
            previousData: activeTerms,
          },
          { returnPromise: true },
        );
      }

      return create(
        "organization_contract_terms",
        {
          data: {
            org_id: orgId,
            version: version.trim() || LBS_DEFAULT_CONTRACT_TERMS_VERSION,
            title: title.trim(),
            body_markdown: body,
            default_variables: getDefaultContractTermsSeed().default_variables,
            is_active: true,
            published_at: new Date().toISOString(),
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["organization_contract_terms"],
      });
      notify("Contract terms saved", { type: "success" });
    },
    onError: () => notify("Failed to save contract terms", { type: "error" }),
  });

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading terms…</p>;
  }

  const loadDefaultSeed = () => {
    const seed = getDefaultContractTermsSeed();
    setVersion(LBS_DEFAULT_CONTRACT_TERMS_VERSION);
    setTitle(seed.title);
    setBody(seed.body_markdown);
  };

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle className="text-base">Contract terms template</CardTitle>
        <CardDescription>
          Use {"{{variables}}"} for merge fields: client_name, total_amount,
          deposit_amount, payment_schedule, recurring_terms, terms_version, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeTerms ? (
          <Button type="button" variant="outline" onClick={loadDefaultSeed}>
            Load default LBS terms
          </Button>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Version</Label>
            <Input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Body (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={18}
            className="font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save terms
        </Button>
      </CardContent>
    </Card>
  );
};
