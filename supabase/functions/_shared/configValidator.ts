import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isOrgTransactionalEmailConfigured } from "./transactionalEmail.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { resolveOrgStripeSecretKey } from "./organizationStripeSettings.ts";
import { logError, logWarn, logInfo } from "./structuredLogger.ts";

export interface ConfigValidationResult {
  stripe: boolean;
  email: boolean;
  sms: boolean;
  storage: boolean;
  details: {
    stripe: { configured: boolean; message: string };
    email: { configured: boolean; message: string };
    sms: { configured: boolean; message: string };
    storage: { configured: boolean; message: string };
  };
}

export class ConfigurationError extends Error {
  public missing: string[];
  public details: ConfigValidationResult["details"];

  constructor(message: string, result: ConfigValidationResult) {
    super(message);
    this.name = "ConfigurationError";
    this.missing = Object.entries(result.details)
      .filter(([_, value]) => !value.configured)
      .map(([key]) => key);
    this.details = result.details;
  }
}

/**
 * Validate Stripe is configured for an organization
 */
export async function validateStripeConfig(
  orgId: number,
): Promise<{ valid: boolean; message: string }> {
  try {
    const secret = await resolveOrgStripeSecretKey(orgId);
    if (!secret) {
      return {
        valid: false,
        message:
          "Stripe secret key not configured. Add your keys under Settings → Integrations → Stripe.",
      };
    }
    return { valid: true, message: "Stripe is configured" };
  } catch (error) {
    await logWarn({
      module: "configValidator",
      operation: "validateStripeConfig",
      message: "Error checking Stripe configuration",
      context: {
        orgId,
        error: error instanceof Error ? error.message : String(error),
      },
      orgId,
    });
    return {
      valid: false,
      message: `Stripe configuration check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate email (Twilio SendGrid) is configured for an organization
 */
export async function validateEmailConfig(
  orgId: number,
): Promise<{ valid: boolean; message: string }> {
  try {
    const configured = await isOrgTransactionalEmailConfigured(orgId);
    if (!configured) {
      return {
        valid: false,
        message:
          "Transactional email is not configured. Add Twilio credentials under Settings → Integrations → Mail.",
      };
    }
    return { valid: true, message: "Twilio email is configured" };
  } catch (error) {
    await logError({
      module: "configValidator",
      operation: "validateEmailConfig",
      error: error,
      context: { orgId },
      orgId,
    });
    return {
      valid: false,
      message: `Email configuration check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate SMS is configured for an organization
 */
export async function validateSmsConfig(
  orgId: number,
): Promise<{ valid: boolean; message: string }> {
  try {
    const settings = await getMessagingSettingsSecrets(orgId);

    if (!settings?.sms_enabled) {
      return {
        valid: false,
        message: "SMS is not enabled in messaging settings.",
      };
    }

    const provider =
      settings.messaging_provider === "telnyx" ? "telnyx" : "twilio";

    if (provider === "telnyx") {
      const apiKey = settings.telnyx_api_key?.trim();
      const phoneNumber = settings.telnyx_phone_number?.trim();

      if (!apiKey) {
        return {
          valid: false,
          message: "Telnyx API key not configured for SMS.",
        };
      }

      if (!phoneNumber) {
        return {
          valid: false,
          message: "Telnyx phone number not configured for SMS.",
        };
      }

      return { valid: true, message: "Telnyx SMS is configured" };
    }

    const accountSid = settings.twilio_account_sid?.trim();
    const authToken = settings.twilio_auth_token?.trim();
    const messagingServiceSid = settings.twilio_messaging_service_sid?.trim();
    const phoneNumber = settings.twilio_phone_number?.trim();

    if (!accountSid || !authToken) {
      return {
        valid: false,
        message: "Twilio Account SID and Auth Token not configured for SMS.",
      };
    }

    if (!messagingServiceSid && !phoneNumber) {
      return {
        valid: false,
        message:
          "Twilio Messaging Service SID or Phone Number not configured for SMS.",
      };
    }

    return { valid: true, message: "Twilio SMS is configured" };
  } catch (error) {
    await logError({
      module: "configValidator",
      operation: "validateSmsConfig",
      error: error,
      context: { orgId },
      orgId,
    });
    return {
      valid: false,
      message: `SMS configuration check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate storage is configured for an organization
 */
export async function validateStorageConfig(
  _supabase: SupabaseClient,
  _orgId: number,
): Promise<{ valid: boolean; message: string }> {
  // Supabase storage is always available if supabase client is configured
  try {
    return { valid: true, message: "Storage is available through Supabase" };
  } catch (error) {
    await logError({
      module: "configValidator",
      operation: "validateStorageConfig",
      error: error,
      context: { orgId: _orgId },
      orgId: _orgId,
    });
    return {
      valid: false,
      message: `Storage configuration check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate all required configurations for invoice payment and delivery
 */
export async function validateInvoicePaymentConfig(
  supabase: SupabaseClient,
  orgId: number,
): Promise<ConfigValidationResult> {
  const [stripeCheck, emailCheck, smsCheck, storageCheck] = await Promise.all([
    validateStripeConfig(orgId),
    validateEmailConfig(orgId),
    validateSmsConfig(orgId),
    validateStorageConfig(supabase, orgId),
  ]);

  const result: ConfigValidationResult = {
    stripe: stripeCheck.valid,
    email: emailCheck.valid,
    sms: smsCheck.valid,
    storage: storageCheck.valid,
    details: {
      stripe: stripeCheck,
      email: emailCheck,
      sms: smsCheck,
      storage: storageCheck,
    },
  };

  const missing = Object.entries(result.details)
    .filter(([_, value]) => !value.configured)
    .map(([key]) => key);

  if (missing.length > 0) {
    await logWarn({
      module: "configValidator",
      operation: "validateInvoicePaymentConfig",
      message: `Missing required configuration: ${missing.join(", ")}`,
      context: { orgId, missing, details: result.details },
      orgId,
    });
    throw new ConfigurationError(
      `Missing required configuration: ${missing.join(", ")}`,
      result,
    );
  }

  await logInfo({
    module: "configValidator",
    operation: "validateInvoicePaymentConfig",
    message: "Invoice payment configuration is valid",
    context: { orgId },
    orgId,
  });

  return result;
}

/**
 * Validate only email configuration (for non-payment operations like invoice sending)
 */
export async function validateInvoiceSendConfig(
  _supabase: SupabaseClient,
  orgId: number,
): Promise<void> {
  const emailCheck = await validateEmailConfig(orgId);
  if (!emailCheck.valid) {
    throw new ConfigurationError(
      `Email is not configured: ${emailCheck.message}`,
      {
        stripe: true,
        email: false,
        sms: true,
        storage: true,
        details: {
          stripe: { configured: true, message: "Not required for send" },
          email: emailCheck,
          sms: { configured: true, message: "Optional for invoice send" },
          storage: { configured: true, message: "Available" },
        },
      },
    );
  }
}

/**
 * Validate minimal config for ticket delivery (email + storage)
 */
export async function validateTicketDeliveryConfig(
  _supabase: SupabaseClient,
  orgId: number,
): Promise<void> {
  const [emailCheck, storageCheck] = await Promise.all([
    validateEmailConfig(orgId),
    { valid: true, message: "Storage is available" },
  ]);

  if (!emailCheck.valid) {
    throw new ConfigurationError(
      `Cannot deliver files: ${emailCheck.message}`,
      {
        stripe: true,
        email: false,
        sms: true,
        storage: true,
        details: {
          stripe: { configured: true, message: "Not required for delivery" },
          email: emailCheck,
          sms: { configured: true, message: "Not required for delivery" },
          storage: storageCheck,
        },
      },
    );
  }
}
