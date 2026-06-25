import type { Identifier } from "ra-core";
import type {
  Deal,
  TaskParticipant,
  Task,
} from "../../../types";
import type { GetScopedTasksParams } from "../../../tasks/scopedTasks";
import {
  collectMyProjectDealIds,
  filterScopedTasks,
} from "../../../tasks/scopedTasksFilter";
import {
  groupTaskParticipantsByTaskId,
  scopeUsesUserCompletionFilter,
} from "../../../tasks/taskUserCompletion";
import { contactNeedsCompanyMove } from "@/modules/clients/primaryContactRelink";
import {
  buildCompanyPayloadFromUpsert,
  buildContactPayloadFromUpsert,
  hasPrimaryContactInput,
  splitClientFullName,
  type LbsClientUpsertInput,
  type LbsClientUpsertResult,
} from "@/modules/clients/lbsClientUpsert";
import {
  buildDealInsertRecord,
  buildNormalizedDealInsertRecord,
  type CreateDealPayload,
} from "@/modules/deals/createDeal";
import { lbsProjectTypeChoices } from "@/modules/deals/lbsProjectConstants";
import { getIsInitialized } from "../authProvider";
import { supabase } from "../supabase";
import { invokeEdgeFunction } from "../invokeEdgeFunction";

const looksLikeUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const resolveOrganizationMemberId = async (
  id: Identifier,
): Promise<Identifier> => {
  if (typeof id !== "string" || !looksLikeUuid(id)) {
    return id;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", id)
    .single();

  if (error || !data?.id) {
    return id;
  }

  return data.id as Identifier;
};

const getCurrentMutationIdentity = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id;
  if (!authUserId) return null;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id, administrator, roles, module_permissions")
    .eq("user_id", authUserId)
    .single();

  if (!member) return null;

  return {
    id: member.id,
    administrator: member.administrator === true,
    role: member.administrator ? "admin" : (member.roles?.[0] ?? "user"),
    roles: member.roles ?? (member.administrator ? ["admin"] : []),
    module_permissions: member.module_permissions ?? null,
  };
};

export const dealsProvider = {
  async isInitialized() {
    return getIsInitialized();
  },
  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { data, error } = await invokeEdgeFunction("merge_contacts", {
      method: "POST",
      body: { loserId: sourceId, winnerId: targetId },
    });

    if (error) {
      console.error("merge_contacts.error", error);
      throw new Error("Failed to merge contacts");
    }

    return data;
  },
  async upsertLbsClient(
    input: LbsClientUpsertInput,
  ): Promise<LbsClientUpsertResult> {
    const memberId = await resolveOrganizationMemberId(
      input.organizationMemberId,
    );
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("id, org_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member?.org_id) {
      throw new Error("Organization member not found");
    }

    const companyName = input.business.name.trim();
    const { firstName, lastName } = splitClientFullName(input.primary.fullName);
    let created = false;

    type ExistingCompany = {
      id: Identifier;
      context_links: string[] | null;
      primary_contact_id: Identifier | null;
    };

    let existingCompany: ExistingCompany | null = null;

    if (input.companyId) {
      const { data, error } = await supabase
        .from("companies")
        .select("id, context_links, primary_contact_id")
        .eq("id", input.companyId)
        .eq("org_id", member.org_id)
        .maybeSingle();

      if (error || !data?.id) {
        throw new Error("Client not found");
      }
      existingCompany = data as ExistingCompany;
    } else {
      const { data } = await supabase
        .from("companies")
        .select("id, context_links, primary_contact_id")
        .eq("org_id", member.org_id)
        .ilike("name", companyName)
        .limit(1)
        .maybeSingle();

      existingCompany = (data as ExistingCompany | null) ?? null;
    }

    const companyPayload = buildCompanyPayloadFromUpsert(
      input,
      existingCompany?.context_links ?? undefined,
    );

    let companyId: Identifier;
    if (existingCompany?.id) {
      const { data: updatedCompany, error: updateCompanyError } = await supabase
        .from("companies")
        .update(companyPayload)
        .eq("id", existingCompany.id)
        .select("id")
        .single();

      if (updateCompanyError || !updatedCompany) {
        throw new Error(
          updateCompanyError?.message || "Failed to update client company",
        );
      }
      companyId = updatedCompany.id;
    } else {
      const { data: newCompany, error: createCompanyError } = await supabase
        .from("companies")
        .insert({
          org_id: member.org_id,
          sector: "information-technology",
          ...companyPayload,
        })
        .select("id")
        .single();

      if (createCompanyError || !newCompany) {
        throw new Error(
          createCompanyError?.message || "Failed to create client company",
        );
      }
      companyId = newCompany.id;
      created = true;
    }

    const resolvePrimaryContactId = async () => {
      if (input.primaryContactId) {
        const { data: existingContact, error: existingContactError } =
          await supabase
            .from("contacts")
            .select("id, company_id")
            .eq("id", input.primaryContactId)
            .eq("org_id", member.org_id)
            .maybeSingle();

        if (existingContactError || !existingContact?.id) {
          throw new Error("Primary contact not found");
        }

        if (
          contactNeedsCompanyMove(existingContact.company_id, companyId) ||
          existingContact.company_id == null
        ) {
          if (contactNeedsCompanyMove(existingContact.company_id, companyId)) {
            const { error: clearPrimaryError } = await supabase
              .from("companies")
              .update({ primary_contact_id: null })
              .eq("primary_contact_id", existingContact.id)
              .eq("org_id", member.org_id);

            if (clearPrimaryError) {
              throw new Error("Failed to clear previous primary contact link");
            }
          }

          const { error: assignCompanyError } = await supabase
            .from("contacts")
            .update({
              company_id: companyId,
              last_seen: new Date().toISOString(),
            })
            .eq("id", existingContact.id);

          if (assignCompanyError) {
            throw new Error("Failed to assign primary contact to company");
          }
        }

        if (input.linkPrimaryContactOnly) {
          return existingContact.id as Identifier;
        }

        const contactPayload = buildContactPayloadFromUpsert(
          input,
          companyId,
          "update",
        );
        const { data: updatedContact, error: updateContactError } =
          await supabase
            .from("contacts")
            .update(contactPayload)
            .eq("id", existingContact.id)
            .select("id")
            .single();

        if (updateContactError || !updatedContact) {
          throw new Error("Failed to update primary contact");
        }
        return updatedContact.id as Identifier;
      }

      const primaryEmail = input.primary.email?.trim().toLowerCase();
      if (primaryEmail) {
        const { data: contactsByCompany } = await supabase
          .from("contacts")
          .select("id, email_jsonb")
          .eq("company_id", companyId);

        const matchedByEmail = contactsByCompany?.find((contact) =>
          (contact.email_jsonb as { email?: string }[] | null)?.some(
            (entry) => entry.email?.trim().toLowerCase() === primaryEmail,
          ),
        );

        if (matchedByEmail?.id) {
          const contactPayload = buildContactPayloadFromUpsert(
            input,
            companyId,
            "update",
          );
          const { data: updatedContact, error: updateContactError } =
            await supabase
              .from("contacts")
              .update(contactPayload)
              .eq("id", matchedByEmail.id)
              .select("id")
              .single();

          if (updateContactError || !updatedContact) {
            throw new Error("Failed to update primary contact");
          }
          return updatedContact.id as Identifier;
        }
      }

      const { data: existingByName } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .ilike("first_name", firstName)
        .ilike("last_name", lastName || firstName)
        .limit(1)
        .maybeSingle();

      if (existingByName?.id) {
        const contactPayload = buildContactPayloadFromUpsert(
          input,
          companyId,
          "update",
        );
        const { data: updatedContact, error: updateContactError } =
          await supabase
            .from("contacts")
            .update(contactPayload)
            .eq("id", existingByName.id)
            .select("id")
            .single();

        if (updateContactError || !updatedContact) {
          throw new Error("Failed to update primary contact");
        }
        return updatedContact.id as Identifier;
      }

      const contactPayload = buildContactPayloadFromUpsert(
        input,
        companyId,
        "create",
      );
      const { data: newContact, error: createContactError } = await supabase
        .from("contacts")
        .insert({
          org_id: member.org_id,
          ...contactPayload,
        })
        .select("id")
        .single();

      if (createContactError || !newContact) {
        throw new Error("Failed to create primary contact");
      }
      return newContact.id as Identifier;
    };

    const contactId = hasPrimaryContactInput(input)
      ? await resolvePrimaryContactId()
      : null;

    const { error: primaryLinkError } = await supabase
      .from("companies")
      .update({ primary_contact_id: contactId })
      .eq("id", companyId);

    if (primaryLinkError) {
      throw new Error("Failed to link primary contact");
    }

    return { company_id: companyId, contact_id: contactId, created };
  },
  async createDeal(payload: CreateDealPayload) {
    let orgId = payload.orgId ?? null;

    if (orgId == null) {
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("org_id")
        .eq("id", payload.companyId)
        .single();

      if (companyError || !company?.org_id) {
        throw new Error("Company not found");
      }
      orgId = company.org_id;
    }

    const insertData = buildNormalizedDealInsertRecord({
      ...payload,
      orgId,
    });

    const { data, error } = await supabase
      .from("deals")
      .insert(insertData)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create deal");
    }

    return { data: data as Deal };
  },
  async convertLeadToClient({
    contactId,
    companyName,
    createDeal = true,
    dealOptions,
  }: {
    contactId: Identifier;
    companyName: string;
    createDeal?: boolean;
    dealOptions?: {
      projectType?: string | null;
      amount?: number | null;
      name?: string | null;
    };
  }) {
    const trimmedName = companyName.trim();
    if (trimmedName.length < 2) {
      throw new Error("Company name must be at least 2 characters");
    }

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, organization_member_id, company_id, org_id, interested_service, lead_value_estimate",
      )
      .eq("id", contactId)
      .single();

    if (contactError || !contact) {
      throw new Error("Lead not found");
    }

    let companyId = contact.company_id as Identifier | null;

    if (companyId) {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id, primary_contact_id")
        .eq("id", companyId)
        .single();

      if (existingCompany?.id) {
        companyId = existingCompany.id;
      } else {
        companyId = null;
      }
    }

    if (!companyId) {
      const orgId = contact.org_id;
      const { data: existingByName } = orgId
        ? await supabase
            .from("companies")
            .select("id, primary_contact_id")
            .eq("org_id", orgId)
            .ilike("name", trimmedName)
            .limit(1)
            .maybeSingle()
        : { data: null };

      if (existingByName?.id) {
        companyId = existingByName.id;
      } else {
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: trimmedName,
            organization_member_id: contact.organization_member_id,
            org_id: contact.org_id,
            sector: "information-technology",
          })
          .select("id, primary_contact_id")
          .single();

        if (companyError || !company) {
          throw new Error("Failed to create client company");
        }
        companyId = company.id;
      }
    }

    const { data: companyRecord } = await supabase
      .from("companies")
      .select("primary_contact_id")
      .eq("id", companyId)
      .single();

    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        company_id: companyId,
      })
      .eq("id", contactId);

    if (updateError) {
      throw new Error("Failed to convert lead");
    }

    if (!companyRecord?.primary_contact_id) {
      await supabase
        .from("companies")
        .update({ primary_contact_id: contactId })
        .eq("id", companyId);
    }

    // ---- Optional: create the initial deal for this conversion ----
    let dealId: number | null = null;
    if (createDeal) {
      const effectiveProjectType =
        dealOptions?.projectType ?? contact.interested_service ?? null;
      const effectiveAmount =
        dealOptions?.amount ??
        (contact.lead_value_estimate != null
          ? Number(contact.lead_value_estimate)
          : null);
      const projectTypeLabel = effectiveProjectType
        ? (lbsProjectTypeChoices.find((c) => c.value === effectiveProjectType)
            ?.label ?? effectiveProjectType)
        : null;
      const dealName =
        dealOptions?.name?.trim() ||
        `${projectTypeLabel ?? "Initial service"} – ${trimmedName}`;

      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert(
          buildDealInsertRecord({
            name: dealName,
            companyId,
            contactId,
            organizationMemberId: contact.organization_member_id,
            orgId: contact.org_id,
            stage: "closed_won",
            lifecyclePhase: "closed",
            amount: effectiveAmount ?? 0,
            estimatedValue: effectiveAmount ?? 0,
            projectType: effectiveProjectType,
            convertedFromContactId: contactId,
          }),
        )
        .select("id")
        .single();

      if (dealError) {
        throw new Error(
          `Lead converted, but failed to create deal: ${dealError.message}`,
        );
      }
      dealId = newDeal?.id ?? null;
      // The DB trigger trg_sync_deal_to_lead_stage automatically sets
      // contacts.lead_stage='won' + snooze_until='2099-12-31' because the
      // deal was inserted with stage='closed_won'.
    }

    // Fallback: if no deal was created (createDeal=false or hasUsefulInfo=false),
    // the trigger never fired. Apply the same lead_stage/snooze_until directly
    // so the contact still exits the Anti-Olvido radar.
    if (dealId == null) {
      await supabase
        .from("contacts")
        .update({
          lead_stage: "won",
          snooze_until: "2099-12-31T00:00:00+00:00",
        })
        .eq("id", contactId);
    }

    return { company_id: companyId, contact_id: contactId, deal_id: dealId };
  },
  async getGithubRepoStatus(payload: { dealId: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      slug: string;
      repo_url: string | null;
      default_branch: string | null;
      last_commit: {
        sha: string;
        short_sha: string;
        message: string;
        author: string;
        date: string | null;
        url: string;
      } | null;
      latest_run: {
        status: string | null;
        conclusion: string | null;
        workflow_name: string | null;
        updated_at: string | null;
        url: string | null;
      } | null;
      github_token_configured: boolean;
      languages?: string[];
      error?: string | null;
    }>("get_github_repo_status", {
      method: "POST",
      body: { deal_id: Number(payload.dealId) },
    });

    if (error || !data) {
      console.error("get_github_repo_status.error", error);
      throw new Error("Failed to load GitHub repository status");
    }

    return data;
  },
  async getScopedTasks(params: GetScopedTasksParams) {
    const usesUserCompletion = scopeUsesUserCompletionFilter(params.scope);
    let query = supabase.from("tasks").select("*", { count: "exact" });

    if (!usesUserCompletion) {
      if (params.status === "open") {
        query = query.is("done_date", null);
      } else {
        query = query.not("done_date", "is", null);
      }
    }

    if (params.typeFilter && params.typeFilter !== "all") {
      query = query.eq("type", params.typeFilter);
    }
    if (params.priorityFilter && params.priorityFilter !== "all") {
      query = query.eq("priority", params.priorityFilter);
    }
    if (params.projectId != null && params.projectId !== "") {
      query = query.eq("deal_id", params.projectId);
    }

    if (params.scope === "tagged") {
      const { data: notifications, error: notificationsError } = await supabase
        .from("task_tag_notifications")
        .select("task_id")
        .eq("recipient_organization_member_id", params.organizationMemberId)
        .is("read_at", null);

      if (notificationsError) {
        console.error("getScopedTasks.tagged.error", notificationsError);
        throw new Error("Failed to load tagged tasks");
      }

      const taskIds = [
        ...new Set(
          (notifications ?? [])
            .map((entry) => entry.task_id)
            .filter((id) => id != null),
        ),
      ];

      if (taskIds.length === 0) {
        return { data: [], total: 0 };
      }

      query = query.in("id", taskIds);
    } else if (params.scope === "mine") {
      const orParts = [
        `organization_member_id.eq.${params.organizationMemberId}`,
      ];
      orParts.push(`mentioned_member_ids.cs.{${params.organizationMemberId}}`);
      orParts.push(`assignee_person_ids.cs.{${params.organizationMemberId}}`);
      orParts.push(
        `collaborator_person_ids.cs.{${params.organizationMemberId}}`,
      );
      query = query.or(orParts.join(","));
    } else if (params.scope === "my_projects") {
      const dealIds = (params.projectDealIds ?? [])
        .map(Number)
        .filter(Number.isFinite);
      if (dealIds.length === 0) {
        return { data: [], total: 0 };
      }
      query = query.in("deal_id", dealIds);
    }

    const sortField = params.sort?.field ?? "due_date";
    const ascending = params.sort?.order !== "DESC";
    query = query.order(sortField, { ascending, nullsFirst: false });

    if (!usesUserCompletion) {
      const page = params.pagination?.page ?? 1;
      const perPage = params.pagination?.perPage ?? 200;
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);
    }

    const { data: rawTasks, count, error } = await query;
    if (error) {
      console.error("getScopedTasks.error", error);
      throw new Error("Failed to load tasks");
    }

    const tasks = (rawTasks ?? []) as Task[];
    let participantsByTaskId: Record<string, TaskParticipant[]> = {};

    if (usesUserCompletion && tasks.length > 0) {
      const taskIds = tasks.map((task) => task.id);
      const { data: participants, error: participantsError } = await supabase
        .from("task_participants")
        .select("*")
        .in("task_id", taskIds);

      if (participantsError) {
        console.error("getScopedTasks.participants.error", participantsError);
        throw new Error("Failed to load task participants");
      }

      participantsByTaskId = groupTaskParticipantsByTaskId(
        (participants ?? []) as TaskParticipant[],
      );

      const filtered = filterScopedTasks(tasks, params, participantsByTaskId);
      return filtered;
    }

    return {
      data: tasks,
      total: count ?? tasks.length,
    };
  },
  async getMyProjectDealIds(params: {
    organizationMemberId: Identifier;
  }) {
    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, organization_member_id, salesperson_ids");

    if (error) {
      console.error("getMyProjectDealIds.error", error);
      throw new Error("Failed to load projects");
    }

    return collectMyProjectDealIds(deals ?? [], params.organizationMemberId);
  },
  async ensureProjectConversation(params: {
    dealId: Identifier;
    title?: string;
  }) {
    const { data, error } = await supabase.rpc("ensure_project_conversation", {
      p_deal_id: params.dealId,
      p_title: params.title?.trim() || null,
    });

    if (error) {
      console.error("ensureProjectConversation.error", error);
      throw new Error(error.message || "Failed to open project team chat");
    }

    return data as Identifier;
  },
  async getAccessEntryPassword(entryId: Identifier) {
    const { data, error } = await invokeEdgeFunction<{
      password?: string | null;
    }>("access_entry_password", {
      method: "POST",
      body: {
        action: "get",
        entry_id: Number(entryId),
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to reveal access entry password",
      );
    }
    return data?.password ?? null;
  },
  async setAccessEntryPassword(entryId: Identifier, password: string | null) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "access_entry_password",
      {
        method: "POST",
        body: {
          action: "set",
          entry_id: Number(entryId),
          password,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to save access entry password",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to save access entry password");
    }
    return data;
  },
  async logAccessEntryAudit(
    entryId: Identifier,
    auditAction: "viewed" | "copied" | "created" | "updated" | "deleted",
  ) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "access_entry_password",
      {
        method: "POST",
        body: {
          action: "audit",
          entry_id: Number(entryId),
          audit_action: auditAction,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to log credential access",
      );
    }
    return data;
  },
  async getLegacyAccessEntryPasswordCount() {
    const { data, error } = await invokeEdgeFunction<{ count?: number }>(
      "access_entry_password",
      {
        method: "POST",
        body: { action: "legacy_count" },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to check legacy credentials",
      );
    }
    return data?.count ?? 0;
  },
  async migrateLegacyAccessEntryPasswords() {
    const { data, error } = await invokeEdgeFunction<{ migrated?: number }>(
      "access_entry_password",
      {
        method: "POST",
        body: { action: "migrate_legacy" },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to migrate legacy credentials",
      );
    }
    return data?.migrated ?? 0;
  },
  async getDealSecretValue(secretId: Identifier) {
    const { data, error } = await invokeEdgeFunction<{
      value?: string | null;
    }>("deal_secret_value", {
      method: "POST",
      body: {
        action: "get",
        secret_id: Number(secretId),
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to reveal deal secret",
      );
    }
    return data?.value ?? null;
  },
  async setDealSecretValue(secretId: Identifier, value: string | null) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "deal_secret_value",
      {
        method: "POST",
        body: {
          action: "set",
          secret_id: Number(secretId),
          value,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to save deal secret",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to save deal secret");
    }
    return data;
  },
  async logDealSecretAudit(
    secretId: Identifier,
    auditAction: "viewed" | "copied" | "created" | "updated" | "deleted",
  ) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "deal_secret_value",
      {
        method: "POST",
        body: {
          action: "audit",
          secret_id: Number(secretId),
          audit_action: auditAction,
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to log secret access",
      );
    }
    return data;
  },
  async deliverProject(payload: {
    deal_id: number;
    site_url?: string;
    plan_name?: string;
    project_start_date?: string;
    delivery_date?: string;
    hosting_renewal_date?: string;
    hosting_status?: string;
    hosting_info?: {
      provider?: string | null;
      panel_url?: string | null;
      managed_by?: "lbs" | "client" | string | null;
      location?: string | null;
    };
    domain_info?: {
      registrar?: string | null;
    };
    site_language?: string;
    included_pages?: string[];
    maintenance_plan?: Record<string, unknown>;
    enabled_sections?: string[];
    checklist_snapshot?: Record<string, unknown>;
    notify_email?: boolean;
    notify_whatsapp?: boolean;
    notify_portal?: boolean;
    share_credential_entry_ids?: number[];
    domain?: {
      domain?: string;
      registrar?: string | null;
      registered_at?: string | null;
      renewal_date?: string | null;
      managed_by?: "lbs" | "client";
      auto_renew?: boolean;
      dns_servers?: string[];
    };
    corporate_emails?: Array<{
      email?: string;
      config_notes?: string | null;
    }>;
    manual_override?: {
      reason: string;
      force_approved_items: Array<{
        id?: number;
        label: string;
        category?: string | null;
      }>;
    };
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      delivery?: { id: number; delivered_at: string };
    }>("deliver_project", {
      method: "POST",
      body: payload,
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ?? "Failed to deliver project",
      );
    }
    if (!data?.ok) {
      throw new Error("Failed to deliver project");
    }
    return data;
  },
  async syncDealBriefResources(dealId: Identifier) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      inserted?: number;
    }>("sync_deal_brief_resources", {
      method: "POST",
      body: { deal_id: Number(dealId) },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to sync brief assets to multimedia",
      );
    }
    return data;
  },
};
