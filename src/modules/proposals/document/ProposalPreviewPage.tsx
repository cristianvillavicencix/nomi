import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useNotify,
  useUpdate,
} from "ra-core";
import { Skeleton } from "@/components/ui/skeleton";
import { ProposalDocumentView } from "@/modules/proposals/document/ProposalDocumentView";
import { ProposalLanguageToggle } from "@/modules/proposals/document/ProposalLanguageToggle";
import { ProposalLocaleProvider } from "@/modules/proposals/document/ProposalLocaleContext";
import { ProposalPreviewToolbar } from "@/modules/proposals/document/ProposalPreviewToolbar";
import {
  getProposalDocumentCopy,
  PROPOSAL_LOCALE_KEY,
  type ProposalLocale,
} from "@/modules/proposals/document/proposalDocumentI18n";
import {
  emptyProposalDocumentContent,
  parseProposalContent,
  proposalContentSnapshot,
  type ProposalDocumentContent,
  type ProposalTemplate,
} from "@/modules/proposals/document/proposalDocumentTypes";
import type { Proposal } from "@/modules/types";
import { newCustomSectionId } from "@/modules/proposals/document/proposalDocumentSections";
import { DEFAULT_PROPOSAL_TEMPLATES } from "@/modules/proposals/document/proposalTemplateDefaults";
import { hydrateProposalContent } from "@/modules/proposals/document/proposalTemplateContent";
import { inferProposalDeckPresetFromLines } from "@/modules/proposals/document/inferProposalDeckPreset";
import type { ProposalDeckPresetId } from "@/modules/proposals/document/proposalDeckSectionOrder";
import {
  PROPOSAL_DECK_REVISION,
  proposalNeedsDeckRevisionRefresh,
} from "@/modules/proposals/document/proposalDeckRevision";
import { useProposalDocumentData } from "@/modules/proposals/document/useProposalDocumentData";
import {
  buildProposalVariableContext,
} from "@/modules/proposals/document/proposalVariableMerge";
import { ProposalVariablesHelp } from "@/modules/proposals/document/ProposalVariablesHelp";
import { ProposalSendActions } from "@/modules/proposals/ProposalSendActions";
import type { ServicePackage } from "@/modules/types";
import { isValidRecordId } from "@/lib/isValidRecordId";

const proposalGetOneQueryKey = (proposalId: string | number) =>
  ["proposals", "getOne", { id: String(proposalId) }] as const;

export const ProposalPreviewPage = () => {
  const { id } = useParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const orgId = Number(identity?.org_id ?? 1);
  const [createTemplate] = useCreate();
  const [updateProposal] = useUpdate();

  const proposalId = isValidRecordId(id) ? id : "";
  const {
    proposal,
    isLoading,
    company,
    contact,
    deal,
    member,
    lines,
    paymentInstallments,
  } = useProposalDocumentData(proposalId, {
    enabled: isValidRecordId(id),
  });

  const { data: templates = [], isPending: isTemplatesPending } =
    useGetList<ProposalTemplate>("proposal_templates", {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "sort_order", order: "ASC" },
    });

  const { data: servicePackages = [] } = useGetList<ServicePackage>(
    "service_packages",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
    },
  );

  const packagesById = useMemo(
    () =>
      new Map(
        servicePackages.map((pkg) => [
          Number(pkg.id),
          { category: pkg.category, name: pkg.name },
        ]),
      ),
    [servicePackages],
  );

  const [content, setContent] = useState<ProposalDocumentContent>(
    emptyProposalDocumentContent,
  );
  const [hydrated, setHydrated] = useState(false);

  const resolveTemplateForSlug = useCallback(
    (slug: ProposalDeckPresetId) =>
      templates.find((row) => row.slug === slug) ?? null,
    [templates],
  );

  const attachTemplateMeta = useCallback(
    (
      draft: ProposalDocumentContent,
      slug: ProposalDeckPresetId,
    ): ProposalDocumentContent => {
      const template = resolveTemplateForSlug(slug);
      return {
        ...draft,
        template_slug: slug,
        template_id: template ? Number(template.id) : draft.template_id ?? null,
      };
    },
    [resolveTemplateForSlug],
  );

  useEffect(() => {
    if (!proposal || hydrated || templates.length === 0) return;

    const parsed = parseProposalContent(proposal.content);
    const inferredSlug = inferProposalDeckPresetFromLines(lines, packagesById);
    const slug =
      (parsed.template_slug as ProposalDeckPresetId | undefined) ?? inferredSlug;

    let next = hydrateProposalContent({
      ...parsed,
      template_slug: slug,
    });
    next = attachTemplateMeta(next, slug);

    setContent(next);
    setHydrated(true);
  }, [
    proposal,
    hydrated,
    templates.length,
    lines,
    packagesById,
    attachTemplateMeta,
  ]);

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

  const activeDeckLabel = useMemo(() => {
    const slug = content.template_slug as ProposalDeckPresetId | undefined;
    const match = slug ? templates.find((row) => row.slug === slug) : null;
    return match?.name ?? slug ?? "Proposal deck";
  }, [content.template_slug, templates]);

  const contentForSave = useMemo(
    (): ProposalDocumentContent => ({
      ...content,
      deck_revision: Math.max(
        content.deck_revision ?? 0,
        PROPOSAL_DECK_REVISION,
      ),
    }),
    [content],
  );

  const saveContent = useMutation({
    mutationFn: async (payload: ProposalDocumentContent) => {
      if (!proposal) return;
      await updateProposal(
        "proposals",
        {
          id: proposal.id,
          data: { content: payload },
          previousData: proposal,
        },
        { returnPromise: true },
      );
      return payload;
    },
    onSuccess: async (savedContent) => {
      if (proposal && savedContent) {
        queryClient.setQueryData<Proposal>(
          proposalGetOneQueryKey(proposal.id),
          (cached) =>
            cached ? { ...cached, content: savedContent } : cached,
        );
      }
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
            content: contentForSave,
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

  const savedContentKey = useMemo(
    () => proposalContentSnapshot(proposal?.content),
    [proposal?.content],
  );

  const draftContentKey = useMemo(
    () => proposalContentSnapshot(contentForSave),
    [contentForSave],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!proposal || !hydrated) return false;
    return draftContentKey !== savedContentKey;
  }, [proposal, hydrated, draftContentKey, savedContentKey]);

  const showDeckSaveHint = useMemo(() => {
    if (!proposal || !hasUnsavedChanges) return false;
    return proposalNeedsDeckRevisionRefresh(
      parseProposalContent(proposal.content),
    );
  }, [proposal, hasUnsavedChanges]);

  const proposalVariables = useMemo(() => {
    if (!proposal) return undefined;
    return buildProposalVariableContext({
      proposal,
      company,
      contact,
      deal,
      member,
    });
  }, [proposal, company, contact, deal, member]);

  const previewLocale = useMemo((): ProposalLocale => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem(PROPOSAL_LOCALE_KEY) === "es" ? "es" : "en";
  }, []);

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

  if (!isValidRecordId(id)) return null;

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
        variablesHelp={
          proposal ? (
            <ProposalVariablesHelp variables={proposalVariables} />
          ) : null
        }
        deckLabel={activeDeckLabel}
        unsavedHint={
          hasUnsavedChanges
            ? getProposalDocumentCopy(previewLocale)[
                showDeckSaveHint
                  ? "deckUpdatedSaveHint"
                  : "saveBeforeClientHint"
              ]
            : undefined
        }
        onSaveTemplate={() => saveAsTemplate.mutate()}
        onSaveContent={() => saveContent.mutate(contentForSave)}
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
          onAddSection={() =>
            setContent((current) => ({
              ...current,
              custom_sections: [
                ...(current.custom_sections ?? []),
                {
                  id: newCustomSectionId(),
                  title: "New section",
                  body: "",
                  image_url: "",
                },
              ],
            }))
          }
        />
        </div>
      </div>
    </ProposalLocaleProvider>
  );
};
