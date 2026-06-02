import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/lbs/proposals/document/ProposalDocumentView";
import { ProposalLanguageToggle } from "@/lbs/proposals/document/ProposalLanguageToggle";
import { ProposalLocaleProvider } from "@/lbs/proposals/document/ProposalLocaleContext";
import { ProposalPreviewToolbar } from "@/lbs/proposals/document/ProposalPreviewToolbar";
import {
  parseProposalContent,
  type ProposalDocumentContent,
  type ProposalTemplate,
} from "@/lbs/proposals/document/proposalDocumentTypes";
import { newCustomSectionId } from "@/lbs/proposals/document/proposalDocumentSections";
import { DEFAULT_PROPOSAL_TEMPLATES } from "@/lbs/proposals/document/proposalTemplateDefaults";
import {
  buildProposalVariableContext,
  mergeProposalVariables,
} from "@/lbs/proposals/document/proposalVariableMerge";
import { useProposalDocumentData } from "@/lbs/proposals/document/useProposalDocumentData";
import { ProposalSendActions } from "@/lbs/proposals/ProposalSendActions";

export const ProposalPreviewPage = () => {
  const { id } = useParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createTemplate] = useCreate();
  const [updateProposal] = useUpdate();

  const proposalId = id!;
  const {
    proposal,
    isLoading,
    company,
    contact,
    deal,
    member,
    lines,
    paymentInstallments,
  } = useProposalDocumentData(proposalId);

  const { data: templates = [], isPending: isTemplatesPending } =
    useGetList<ProposalTemplate>("proposal_templates", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "sort_order", order: "ASC" },
    });

  const [content, setContent] = useState<ProposalDocumentContent>(() =>
    parseProposalContent(proposal?.content),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const autoAppliedRef = useRef(false);

  useEffect(() => {
    if (!proposal || hydrated) return;
    setContent(parseProposalContent(proposal.content));
    setHydrated(true);
  }, [proposal, hydrated]);

  useEffect(() => {
    if (selectedTemplateId || templates.length === 0) return;
    const fromProposal = content.template_id
      ? String(content.template_id)
      : null;
    if (fromProposal && templates.some((t) => String(t.id) === fromProposal)) {
      setSelectedTemplateId(fromProposal);
      return;
    }
    setSelectedTemplateId(String(templates[0].id));
  }, [content.template_id, selectedTemplateId, templates]);

  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((row) => String(row.id) === templateId);
      if (!template || !proposal) return;

      const variables = buildProposalVariableContext({
        proposal,
        company,
        contact,
        deal,
        member,
      });
      const merged = mergeProposalVariables(
        template.content as Record<string, string | undefined>,
        variables,
      );

      setContent({
        ...parseProposalContent(template.content),
        ...merged,
        template_id: Number(template.id),
        template_slug: template.slug,
      });
      setSelectedTemplateId(templateId);
    },
    [templates, proposal, company, contact, deal, member],
  );

  const seedTemplates = useMutation({
    mutationFn: async () => {
      for (const seed of DEFAULT_PROPOSAL_TEMPLATES) {
        await createTemplate(
          "proposal_templates",
          {
            data: {
              org_id: orgId,
              name: seed.name,
              slug: seed.slug,
              category: seed.category,
              content: seed.content,
              is_system: true,
              active: true,
              sort_order: seed.sort_order,
            },
          },
          { returnPromise: true },
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposal_templates"] });
      notify("Default templates loaded", { type: "success" });
    },
  });

  useEffect(() => {
    if (!isTemplatesPending && templates.length === 0 && !seedTemplates.isPending) {
      seedTemplates.mutate();
    }
  }, [isTemplatesPending, templates.length, seedTemplates.isPending]);

  useEffect(() => {
    if (
      autoAppliedRef.current ||
      !hydrated ||
      !proposal ||
      templates.length === 0 ||
      !selectedTemplateId
    ) {
      return;
    }
    const parsed = parseProposalContent(proposal.content);
    const hasDraft = Boolean(parsed.intro_body?.trim() || parsed.warranty_body?.trim());
    if (!hasDraft) {
      autoAppliedRef.current = true;
      applyTemplate(selectedTemplateId);
    }
  }, [hydrated, proposal, templates.length, selectedTemplateId, applyTemplate]);

  const saveContent = useMutation({
    mutationFn: async () => {
      if (!proposal) return;
      await updateProposal(
        "proposals",
        {
          id: proposal.id,
          data: { content },
          previousData: proposal,
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposals"] });
      notify("Proposal content saved", { type: "success" });
    },
    onError: () => notify("Failed to save content", { type: "error" }),
  });

  const saveAsTemplate = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Template name");
      if (!name?.trim()) return;
      const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await createTemplate(
        "proposal_templates",
        {
          data: {
            org_id: orgId,
            name: name.trim(),
            slug: slug || `template-${Date.now()}`,
            content,
            active: true,
            sort_order: templates.length + 1,
          },
        },
        { returnPromise: true },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["proposal_templates"] });
      notify("Template saved", { type: "success" });
    },
  });

  const stepper = useMemo(
    () => (
      <div className="flex items-center justify-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">1. Build</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-medium text-primary">2. Draft & review</span>
        <span className="text-muted-foreground">→</span>
        <span className="text-muted-foreground">3. Client accepts</span>
      </div>
    ),
    [],
  );

  if (!id) return null;

  if (isLoading || isTemplatesPending) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <ProposalLocaleProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0">{stepper}</div>
        <div className="shrink-0">
      <ProposalPreviewToolbar
        proposalId={proposalId}
        languageToggle={<ProposalLanguageToggle />}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={applyTemplate}
        onSaveTemplate={() => saveAsTemplate.mutate()}
        onSaveContent={() => saveContent.mutate()}
        onAddSection={() =>
          setContent((current) => ({
            ...current,
            custom_sections: [
              ...(current.custom_sections ?? []),
              {
                id: newCustomSectionId(),
                title: "New section",
                body: "",
              },
            ],
          }))
        }
        isSaving={saveContent.isPending}
        sendActions={
          proposal ? (
            <ProposalSendActions
              proposal={proposal}
              lineItems={lines}
              installments={paymentInstallments}
              confirmExpiryBeforeSend
              onSent={async () => {
                await queryClient.invalidateQueries({ queryKey: ["proposals"] });
              }}
            />
          ) : null
        }
      />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <ProposalDocumentView
          proposalId={proposalId}
          content={content}
          editable
          clientView={false}
          showSectionNav
          onContentChange={(patch) =>
            setContent((current) => ({ ...current, ...patch }))
          }
          onRemoveCustomSection={(customSectionId) =>
            setContent((current) => ({
              ...current,
              custom_sections: (current.custom_sections ?? []).filter(
                (section) => section.id !== customSectionId,
              ),
            }))
          }
        />
        </div>
      </div>
    </ProposalLocaleProvider>
  );
};

