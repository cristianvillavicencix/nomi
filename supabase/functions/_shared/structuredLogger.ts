import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export interface LogEntry {
  level: LogLevel;
  module: string;
  operation: string;
  context: Record<string, unknown>;
  timestamp: string;
  userId?: number;
  orgId?: number;
  invoiceId?: number;
  ticketId?: number;
  paymentIntentId?: string;
}

/**
 * Sistema de logging estructurado para mejor monitoreo y debugging
 * Reemplaza console.error/warn genéricos con logging contextual
 */
export async function logStructured(entry: LogEntry) {
  const timestamp = entry.timestamp || new Date().toISOString();

  // Guardar en tabla de logs (si existe la tabla)
  try {
    await supabaseAdmin.from("system_logs").insert({
      level: entry.level,
      module: entry.module,
      operation: entry.operation,
      context: entry.context,
      timestamp,
      user_id: entry.userId,
      org_id: entry.orgId,
      invoice_id: entry.invoiceId,
      ticket_id: entry.ticketId,
      payment_intent_id: entry.paymentIntentId,
      created_at: timestamp,
    });
  } catch (dbError) {
    // Si la tabla no existe, no fallar el sistema
    // Solo loggear a console para debugging
    console.warn("[structuredLogger] Database logging unavailable", {
      error: dbError instanceof Error ? dbError.message : String(dbError),
    });
  }

  // También console para debugging local con formato estructurado
  const consoleMethod =
    entry.level === LogLevel.ERROR
      ? console.error
      : entry.level === LogLevel.WARN
        ? console.warn
        : entry.level === LogLevel.DEBUG
          ? console.debug
          : console.log;

  const logPrefix = `[${entry.module}] ${entry.operation}`;
  const logContext = {
    ...entry.context,
    timestamp,
    ...(entry.userId && { userId: entry.userId }),
    ...(entry.orgId && { orgId: entry.orgId }),
    ...(entry.invoiceId && { invoiceId: entry.invoiceId }),
    ...(entry.ticketId && { ticketId: entry.ticketId }),
  };

  consoleMethod(logPrefix, logContext);
}

/**
 * Helper para logging de errores con contexto completo
 */
export async function logError(params: {
  module: string;
  operation: string;
  error: unknown;
  context?: Record<string, unknown>;
  orgId?: number;
  userId?: number;
  invoiceId?: number;
  ticketId?: number;
  paymentIntentId?: string;
}) {
  const errorMessage =
    params.error instanceof Error ? params.error.message : String(params.error);
  const errorStack =
    params.error instanceof Error ? params.error.stack : undefined;

  await logStructured({
    level: LogLevel.ERROR,
    module: params.module,
    operation: params.operation,
    context: {
      ...params.context,
      error: errorMessage,
      ...(errorStack && { stack: errorStack }),
    },
    timestamp: new Date().toISOString(),
    userId: params.userId,
    orgId: params.orgId,
    invoiceId: params.invoiceId,
    ticketId: params.ticketId,
    paymentIntentId: params.paymentIntentId,
  });
}

/**
 * Helper para logging de warnings
 */
export async function logWarn(params: {
  module: string;
  operation: string;
  message: string;
  context?: Record<string, unknown>;
  orgId?: number;
  userId?: number;
  invoiceId?: number;
  ticketId?: number;
}) {
  await logStructured({
    level: LogLevel.WARN,
    module: params.module,
    operation: params.operation,
    context: {
      ...params.context,
      message: params.message,
    },
    timestamp: new Date().toISOString(),
    userId: params.userId,
    orgId: params.orgId,
    invoiceId: params.invoiceId,
    ticketId: params.ticketId,
  });
}

/**
 * Helper para logging de información
 */
export async function logInfo(params: {
  module: string;
  operation: string;
  message: string;
  context?: Record<string, unknown>;
  orgId?: number;
  userId?: number;
  invoiceId?: number;
  ticketId?: number;
}) {
  await logStructured({
    level: LogLevel.INFO,
    module: params.module,
    operation: params.operation,
    context: {
      ...params.context,
      message: params.message,
    },
    timestamp: new Date().toISOString(),
    userId: params.userId,
    orgId: params.orgId,
    invoiceId: params.invoiceId,
    ticketId: params.ticketId,
  });
}

/**
 * Helper para logging de debug
 */
export async function logDebug(params: {
  module: string;
  operation: string;
  message: string;
  context?: Record<string, unknown>;
  orgId?: number;
  userId?: number;
  invoiceId?: number;
  ticketId?: number;
}) {
  await logStructured({
    level: LogLevel.DEBUG,
    module: params.module,
    operation: params.operation,
    context: {
      ...params.context,
      message: params.message,
    },
    timestamp: new Date().toISOString(),
    userId: params.userId,
    orgId: params.orgId,
    invoiceId: params.invoiceId,
    ticketId: params.ticketId,
  });
}
