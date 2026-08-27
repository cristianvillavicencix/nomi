import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { sendTransactionalEmail } from "./transactionalEmail.ts";
import {
  buildTicketDeliveredInternalNoteBody,
  buildTicketDeliveryEmailSubject,
} from "./ticketInvoiceFlow.ts";
import { buildTicketDeliveryEmailHtml } from "./ticketEmailTemplates.ts";
import { loadCombinedInvoiceTicketIds } from "./combinedTicketInvoiceFlow.ts";
import { createPublicFileLinksForStoragePaths } from "./fileAccessToken.ts";
import { parseStorageObjectReference } from "./storageObjectUrl.ts";
import { logError, logWarn, logInfo, logDebug } from "./structuredLogger.ts";
import {
  validateTicketDeliveryConfig,
  ConfigurationError,
} from "./configValidator.ts";

const buildMessageId = (ticketId: number) =>
  `<ticket-${ticketId}-${crypto.randomUUID()}@nomicrm.com>`;

/** Always deliver via signed links (avoids Edge OOM from Base64 attachments). */
const DOWNLOAD_LINK_EXPIRES_SEC = 60 * 60 * 24 * 7; // 7 days

const deliveryEmailFailureReason = (emailResult: {
  skipped?: boolean;
  reason?: string | null;
}) => {
  if (!emailResult.skipped) return null;
  if (emailResult.reason === "channel_paused") {
    return "Ticket email channel is paused. Re-enable it under Settings → Integrations → Mail.";
  }
  return "Delivery email was skipped. Check Communications settings and try Retry delivery.";
};

export async function noteTicketDeliveryFailure(
  supabase: SupabaseClient,
  params: { ticketId: number; error: unknown },
) {
  const detail =
    params.error instanceof Error && params.error.message.trim()
      ? params.error.message.trim()
      : "Unknown error";
  const body =
    `**Automatic delivery failed**\n\n${detail}\n\n` +
    `Open Billing and use **Retry delivery** to send the files again.`;
  try {
    await supabase.from("ticket_messages").insert({
      ticket_id: params.ticketId,
      body,
      direction: "internal",
      from_name: "System",
      created_at: new Date().toISOString(),
    });
  } catch (noteError) {
    await logError({
      module: "ticketDelivery",
      operation: "noteTicketDeliveryFailure",
      error: noteError,
      context: { ticketId: params.ticketId },
    });
  }
}

type DeliveryFile = {
  id: number;
  title: string;
  type?: string | null;
  path?: string | null;
  src?: string | null;
  sort_order?: number | null;
};

async function buildDownloadLinks(files: DeliveryFile[], orgId?: number) {
  const resolveStorageFile = (file: DeliveryFile) => {
    const name = file.title?.trim() || "file";
    const path = file.path?.trim();
    if (path) {
      return {
        bucket: "attachments",
        path,
        filename: name,
        mimeType: file.type ?? null,
      };
    }
    const parsed = parseStorageObjectReference(
      file.src?.trim() ?? "",
      "attachments",
    );
    if (!parsed) return null;
    return {
      bucket: parsed.bucket,
      path: parsed.path,
      filename: name,
      mimeType: file.type ?? null,
    };
  };

  const storageFiles = files
    .map((file) => resolveStorageFile(file))
    .filter(Boolean) as Array<{
    bucket: string;
    path: string;
    filename: string;
    mimeType: string | null;
  }>;

  const links =
    storageFiles.length > 0
      ? await createPublicFileLinksForStoragePaths(storageFiles, {
          expiresInSec: DOWNLOAD_LINK_EXPIRES_SEC,
          purpose: "ticket_delivery",
          orgId,
        })
      : [];

  for (const file of files) {
    if (resolveStorageFile(file)) continue;
    const name = file.title?.trim() || "file";
    throw new Error(
      `Could not create a download link for "${name}". Retry delivery or share the file manually.`,
    );
  }

  if (links.length === 0) {
    throw new Error("Could not create download links for delivery files.");
  }
  return links;
}

async function deliverOneTicketForInvoicePayment(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
    ticketId: number;
    invoiceNumber: string;
  },
) {
  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, org_id, subject, status, inbox_address, requester_email, requester_name, delivery_status, merged_into_ticket_id",
    )
    .eq("id", params.ticketId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!ticket?.id || ticket.merged_into_ticket_id) {
    return {
      delivered: false,
      skipped: true,
      reason: "ticket_missing_or_merged",
    };
  }

  if (ticket.delivery_status === "delivered") {
    const { count: pendingForInvoice } = await supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("invoiced_invoice_id", params.invoiceId)
      .is("delivered_at", null);

    if (!pendingForInvoice) {
      return {
        delivered: true,
        skipped: true,
        duplicate: true,
        ticket_id: ticket.id,
      };
    }
  }

  const { data: deliverables } = await supabase
    .from("ticket_deliverables")
    .select("id, title, type, path, src, sort_order")
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null)
    .order("sort_order", { ascending: true });

  if (!deliverables?.length) {
    return {
      delivered: false,
      skipped: true,
      reason: "no_deliverables",
      ticket_id: ticket.id,
    };
  }

  const recipient = ticket.requester_email?.trim().toLowerCase() ?? "";
  if (!recipient) {
    return {
      delivered: false,
      skipped: true,
      reason: "missing_recipient",
      ticket_id: ticket.id,
    };
  }

  let inboxAddress = ticket.inbox_address?.trim().toLowerCase() ?? "";
  let fromName = "LBS Supplements";

  if (inboxAddress) {
    const { data: inbox } = await supabase
      .from("ticket_inboxes")
      .select("email, from_name, display_name, is_active")
      .eq("org_id", params.orgId)
      .eq("email", inboxAddress)
      .maybeSingle();
    if (inbox?.is_active === false) {
      return {
        delivered: false,
        skipped: true,
        reason: "inbox_paused",
        ticket_id: ticket.id,
      };
    }
    if (inbox?.from_name?.trim()) fromName = inbox.from_name.trim();
    else if (inbox?.display_name?.trim()) fromName = inbox.display_name.trim();
  } else {
    const { data: defaultInbox } = await supabase
      .from("ticket_inboxes")
      .select("email, from_name, display_name")
      .eq("org_id", params.orgId)
      .eq("is_active", true)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    inboxAddress = defaultInbox?.email?.trim().toLowerCase() ?? "";
    if (defaultInbox?.from_name?.trim())
      fromName = defaultInbox.from_name.trim();
  }

  if (!inboxAddress) {
    return {
      delivered: false,
      skipped: true,
      reason: "missing_inbox",
      ticket_id: ticket.id,
    };
  }

  const now = new Date().toISOString();
  const propertyAddress = ticket.subject?.trim() || "Your property";
  const subject = buildTicketDeliveryEmailSubject(propertyAddress);
  const fileNames = deliverables.map((file) => file.title);
  const downloadLinks = await buildDownloadLinks(
    deliverables as DeliveryFile[],
    params.orgId,
  );
  const textBody =
    `Thank you for your payment (${params.invoiceNumber}). ` +
    `Your supplement files for ${propertyAddress} are ready to download (links expire in 7 days):\n` +
    downloadLinks.map((file) => `- ${file.name}: ${file.url}`).join("\n");
  const htmlBody = buildTicketDeliveryEmailHtml({
    orgName: fromName,
    invoiceNumber: params.invoiceNumber,
    propertyAddress,
    fileNames,
    downloadLinks,
  });
  const outboundMessageId = buildMessageId(ticket.id);

  // Validar que el email esté configurado antes de enviar
  try {
    await validateTicketDeliveryConfig(supabase, params.orgId);
  } catch (configError) {
    await logError({
      module: "ticketDelivery",
      operation: "deliverOneTicketForInvoicePayment",
      error: configError,
      context: {
        invoiceId: params.invoiceId,
        ticketId: params.ticketId,
        orgId: params.orgId,
      },
      orgId: params.orgId,
      ticketId: params.ticketId,
      invoiceId: params.invoiceId,
    });
    throw new ConfigurationError(
      configError instanceof Error
        ? configError.message
        : "Email not configured for delivery",
      {
        stripe: true,
        email: false,
        sms: true,
        storage: true,
        details: {
          stripe: { configured: true, message: "Not required for delivery" },
          email: {
            configured: false,
            message:
              configError instanceof Error
                ? configError.message
                : "Email not configured",
          },
          sms: { configured: true, message: "Not required for delivery" },
          storage: { configured: true, message: "Storage available" },
        },
      },
    );
  }

  const emailResult = await sendTransactionalEmail({
    orgId: params.orgId,
    to: [recipient],
    subject,
    textBody,
    htmlBody,
    fromEmail: inboxAddress,
    fromName,
    replyTo: inboxAddress,
  });

  const deliveryFailure = deliveryEmailFailureReason(emailResult);
  if (deliveryFailure) {
    throw new Error(deliveryFailure);
  }

  // Links live in the email body only — do not mirror files into
  // message.attachments (avoids Documents & links duplication in the CRM).
  const { data: message, error: messageError } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticket.id,
      body: textBody,
      html_body: htmlBody,
      direction: "outbound",
      from_email: inboxAddress,
      from_name: fromName,
      to_emails: [recipient],
      external_message_id: outboundMessageId,
      attachments: [],
      created_at: now,
    })
    .select("id")
    .single();

  if (messageError) {
    throw new Error(messageError.message ?? "Could not save delivery message");
  }

  await supabase
    .from("ticket_deliverables")
    .update({ delivered_at: now })
    .eq("ticket_id", ticket.id)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null);

  const [
    { count: undeliveredInvoiced },
    { count: unbilledDeliverables },
    { count: otherSentInvoices },
  ] = await Promise.all([
    supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .not("invoiced_invoice_id", "is", null)
      .is("delivered_at", null),
    supabase
      .from("ticket_deliverables")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .is("invoiced_invoice_id", null),
    supabase
      .from("client_invoices")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .eq("org_id", params.orgId)
      .eq("status", "sent")
      .neq("id", params.invoiceId),
  ]);

  const ticketUpdate: {
    updated_at: string;
    status?: string;
    delivery_status?: string;
    delivered_at?: string | null;
  } = { updated_at: now };

  if (
    (undeliveredInvoiced ?? 0) === 0 &&
    (unbilledDeliverables ?? 0) === 0 &&
    (otherSentInvoices ?? 0) === 0
  ) {
    ticketUpdate.status = "resolved";
    ticketUpdate.delivery_status = "delivered";
    ticketUpdate.delivered_at = now;
  } else if ((unbilledDeliverables ?? 0) > 0) {
    ticketUpdate.delivery_status = "ready";
  } else {
    ticketUpdate.delivery_status = "invoice_sent";
  }

  await supabase
    .from("tickets")
    .update(ticketUpdate)
    .eq("id", ticket.id)
    .eq("org_id", params.orgId);

  await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    body: buildTicketDeliveredInternalNoteBody({
      invoiceNumber: params.invoiceNumber,
      propertyAddress: ticket.subject,
      fileCount: deliverables.length,
      recipientEmail: recipient,
    }),
    direction: "internal",
    from_name: "System",
    created_at: now,
  });

  return {
    delivered: true,
    ticket_id: ticket.id,
    message_id: message?.id ?? null,
    email_sent: !emailResult.skipped,
    file_count: deliverables.length,
  };
}

async function validateDeliveryPreconditions(
  supabase: SupabaseClient,
  params: { invoiceId: number; orgId: number },
): Promise<{ valid: boolean; reason?: string }> {
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("id, status")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.id) {
    return { valid: false, reason: "invoice_not_found" };
  }

  if (invoice.status !== "paid") {
    return { valid: false, reason: "invoice_not_paid" };
  }

  return { valid: true };
}

async function resolveTicketIdWithFallbacks(
  supabase: SupabaseClient,
  params: { invoiceId: number; orgId: number },
): Promise<{ ticketId: number | null; method: string }> {
  // Fallback 1: invoice.ticket_id (método actual - backward compatibility)
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("ticket_id")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (invoice?.ticket_id) {
    return { ticketId: Number(invoice.ticket_id), method: "invoice_ticket_id" };
  }

  // Fallback 2: client_invoice_tickets (combined invoices)
  const linkedTicketIds = await loadCombinedInvoiceTicketIds(
    supabase,
    params.orgId,
    params.invoiceId,
  );

  if (linkedTicketIds.length > 0) {
    return { ticketId: linkedTicketIds[0], method: "combined_invoice_tickets" };
  }

  // Fallback 3: ticket_deliverables.invoiced_invoice_id (direct file linkage)
  const { data: deliverableLink } = await supabase
    .from("ticket_deliverables")
    .select("ticket_id")
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (deliverableLink?.ticket_id) {
    return {
      ticketId: Number(deliverableLink.ticket_id),
      method: "deliverable_invoice_link",
    };
  }

  // Fallback 4: tickets.invoice_id (backward compatibility - ticket might still have invoice_id)
  const { data: ticketByInvoiceId } = await supabase
    .from("tickets")
    .select("id")
    .eq("invoice_id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (ticketByInvoiceId?.id) {
    return {
      ticketId: Number(ticketByInvoiceId.id),
      method: "ticket_invoice_id_backward_compat",
    };
  }

  return { ticketId: null, method: "all_fallbacks_failed" };
}

async function validateDeliverableLinks(
  supabase: SupabaseClient,
  params: { invoiceId: number; orgId: number; ticketId: number },
): Promise<{ valid: boolean; deliverableCount: number; reason?: string }> {
  const { count } = await supabase
    .from("ticket_deliverables")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", params.ticketId)
    .eq("org_id", params.orgId)
    .eq("invoiced_invoice_id", params.invoiceId)
    .is("delivered_at", null);

  const deliverableCount = count ?? 0;

  if (deliverableCount === 0) {
    return {
      valid: false,
      deliverableCount: 0,
      reason: "no_undelivered_deliverables",
    };
  }

  return { valid: true, deliverableCount };
}

async function deliverWithRetry(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
    ticketId: number;
    invoiceNumber: string;
  },
  maxRetries: number = 3,
): Promise<{
  delivered: boolean;
  skipped: boolean;
  reason?: string;
  attempts: number;
}> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await deliverOneTicketForInvoicePayment(supabase, params);

      if (result.delivered || result.skipped) {
        return { ...result, attempts: attempt };
      }

      // Si no fue entregido y no fue skipped, intentar retry
      lastError = new Error(`Delivery attempt ${attempt} failed`);

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt - 1) * 1000),
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt - 1) * 1000),
        );
      }
    }
  }

  return {
    delivered: false,
    skipped: false,
    reason: lastError?.message || "max_retries_exceeded",
    attempts: maxRetries,
  };
}

export async function deliverTicketAfterInvoicePayment(
  supabase: SupabaseClient,
  params: {
    invoiceId: number;
    orgId: number;
  },
) {
  // 1. Validación inicial con logging estructurado
  const validation = await validateDeliveryPreconditions(supabase, params);
  if (!validation.valid) {
    await logError({
      module: "ticketDelivery",
      operation: "validateDeliveryPreconditions",
      error: new Error(validation.reason),
      context: {
        invoiceId: params.invoiceId,
        orgId: params.orgId,
        reason: validation.reason,
      },
    });
    return { delivered: false, skipped: true, reason: validation.reason };
  }

  // 2. Sistema de fallback multi-capa para encontrar ticket_id
  const { ticketId, method } = await resolveTicketIdWithFallbacks(
    supabase,
    params,
  );

  if (!ticketId) {
    await logError({
      module: "ticketDelivery",
      operation: "resolveTicketIdWithFallbacks",
      error: new Error("No ticket found via any fallback method"),
      context: { invoiceId: params.invoiceId, orgId: params.orgId, method },
    });
    return { delivered: false, skipped: true, reason: "no_ticket_found" };
  }

  await logInfo({
    module: "ticketDelivery",
    operation: "resolveTicketIdWithFallbacks",
    message: "Ticket resolved successfully",
    context: {
      invoiceId: params.invoiceId,
      orgId: params.orgId,
      ticketId,
      method,
    },
  });

  // 3. Validación de que los archivos estén correctamente vinculados
  const deliverableCheck = await validateDeliverableLinks(supabase, {
    ...params,
    ticketId,
  });

  if (!deliverableCheck.valid) {
    await logWarn({
      module: "ticketDelivery",
      operation: "validateDeliverableLinks",
      message: "No deliverables to send",
      context: {
        invoiceId: params.invoiceId,
        ticketId,
        deliverableCount: deliverableCheck.deliverableCount,
        reason: deliverableCheck.reason,
      },
    });
    return { delivered: false, skipped: true, reason: deliverableCheck.reason };
  }

  // 4. Actualizar invoice.ticket_id si está null (para backward compatibility)
  const nowIso = new Date().toISOString();
  const { data: currentInvoice } = await supabase
    .from("client_invoices")
    .select("ticket_id")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (currentInvoice && !currentInvoice.ticket_id) {
    await supabase
      .from("client_invoices")
      .update({ ticket_id: ticketId, updated_at: nowIso })
      .eq("id", params.invoiceId)
      .eq("org_id", params.orgId);

    await logInfo({
      module: "ticketDelivery",
      operation: "updateInvoiceTicketId",
      message: "Updated invoice.ticket_id for backward compatibility",
      context: { invoiceId: params.invoiceId, ticketId },
    });
  }

  // 5. Obtener invoice_number para delivery
  const { data: invoice } = await supabase
    .from("client_invoices")
    .select("invoice_number")
    .eq("id", params.invoiceId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (!invoice?.invoice_number) {
    await logError({
      module: "ticketDelivery",
      operation: "getInvoiceNumber",
      error: new Error("Invoice number missing"),
      context: { invoiceId: params.invoiceId },
    });
    return {
      delivered: false,
      skipped: true,
      reason: "invoice_number_missing",
    };
  }

  // 6. Sistema de retry con exponential backoff
  const result = await deliverWithRetry(supabase, {
    invoiceId: params.invoiceId,
    orgId: params.orgId,
    ticketId,
    invoiceNumber: invoice.invoice_number,
  });

  if (!result.delivered && !result.skipped) {
    await logError({
      module: "ticketDelivery",
      operation: "deliverWithRetry",
      error: new Error(result.reason || "Delivery failed after retries"),
      context: {
        invoiceId: params.invoiceId,
        ticketId,
        attempts: result.attempts,
        reason: result.reason,
      },
    });

    // Notificar fallo de delivery
    await noteTicketDeliveryFailure(supabase, {
      ticketId,
      error: new Error(result.reason || "Delivery failed after retries"),
    });
  }

  return result;
}
