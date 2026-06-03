import type { ProposalDeckPresetId } from "@/lbs/proposals/document/proposalDeckSectionOrder";
import type { ProposalDocumentContent } from "@/lbs/proposals/document/proposalDocumentTypes";

type CommercialFields = Pick<
  ProposalDocumentContent,
  "investment_title" | "investment_notes" | "payment_notes" | "warranty_title" | "warranty_body"
> & {
  locales?: {
    es?: Pick<
      ProposalDocumentContent,
      "investment_title" | "investment_notes" | "payment_notes"
    >;
  };
};

const noWarranty = { warranty_title: "", warranty_body: "" } as const;

export const PROPOSAL_COMMERCIAL_COPY_BY_PRESET: Partial<
  Record<ProposalDeckPresetId, CommercialFields>
> = {
  "website-contractor": {
    ...noWarranty,
    investment_title: "Summary and payment plan",
    investment_notes:
      "The amounts below come from the package and add-ons you selected in our builder. One-time fees cover strategy, design, development, QA, and launch. Any monthly services are shown separately and billed on their own schedule.",
    payment_notes:
      "A 50% deposit reserves your kickoff date and is due when you accept this proposal. The remaining balance follows the installment schedule below. We send invoices by email; production work begins after the deposit is received. Recurring services (if listed) start on the date noted in your agreement.",
    locales: {
      es: {
        investment_title: "Resumen y plan de pagos",
        investment_notes:
          "Los montos reflejan el paquete y complementos que elegiste en el configurador. Los pagos únicos cubren estrategia, diseño, desarrollo, QA y lanzamiento. Los servicios mensuales, si aplican, se muestran aparte.",
        payment_notes:
          "El depósito del 50% reserva tu fecha de kickoff y vence al aceptar esta propuesta. El saldo sigue el calendario de cuotas abajo. Enviamos facturas por email; el trabajo inicia al recibir el depósito.",
      },
    },
  },
  "website-redesign": {
    ...noWarranty,
    investment_title: "Summary and payment plan",
    investment_notes:
      "Pricing reflects your redesign scope: audit, design, rebuild, migration, and launch. Add-ons and monthly care (if selected) are itemized separately.",
    payment_notes:
      "Deposit due on acceptance to schedule the audit workshop. Balance per the schedule below. Redirect and migration work is included in the one-time fee unless your scope note says otherwise.",
    locales: {
      es: {
        investment_title: "Resumen y plan de pagos",
        investment_notes:
          "Los precios reflejan el alcance del rediseño: auditoría, diseño, rebuild, migración y lanzamiento. Complementos y cuidado mensual, si aplican, van aparte.",
        payment_notes:
          "Depósito al aceptar para agendar la auditoría. Saldo según el calendario. Redirecciones y migración incluidas salvo nota contraria en el alcance.",
      },
    },
  },
  "digital-marketing": {
    ...noWarranty,
    investment_title: "Summary and payment plan",
    investment_notes:
      "Management fees below cover strategy, setup, optimization, and reporting. Ad spend is paid directly to Google, Meta, or other platforms unless we agree otherwise in writing.",
    payment_notes:
      "First month’s management fee is due on acceptance to begin onboarding. Recurring management is billed monthly in advance. Pauses or budget changes require written notice per your agreement.",
    locales: {
      es: {
        investment_title: "Resumen y plan de pagos",
        investment_notes:
          "Los honorarios cubren estrategia, configuración, optimización y reportes. La inversión en ads se paga directo a las plataformas salvo acuerdo escrito.",
        payment_notes:
          "El primer mes de gestión vence al aceptar para iniciar onboarding. Lo recurrente se factura mensual por adelantado.",
      },
    },
  },
  skop: {
    ...noWarranty,
    investment_title: "Summary and payment plan",
    investment_notes:
      "Subscription and seat counts reflect the SKOP plan you selected. Training or onboarding add-ons appear as separate line items when applicable.",
    payment_notes:
      "Payment is due per your selected billing cycle (monthly or annual). Access is provisioned after payment clears. Seat changes can be adjusted in writing before renewal.",
    locales: {
      es: {
        investment_title: "Resumen y plan de pagos",
        investment_notes:
          "La suscripción y usuarios reflejan el plan SKOP elegido. Capacitación u onboarding aparecen como líneas aparte si aplican.",
        payment_notes:
          "El pago sigue tu ciclo elegido (mensual o anual). El acceso se activa al confirmarse el pago.",
      },
    },
  },
  blank: {
    ...noWarranty,
    investment_title: "Summary and payment plan",
    investment_notes:
      "Line items and totals below summarize the services in this proposal. One-time and recurring charges are labeled in each row.",
    payment_notes:
      "Deposit and installment timing follow the schedule below unless your contract states otherwise. Contact {{preparada_por}} with billing questions before you sign.",
    locales: {
      es: {
        investment_title: "Resumen y plan de pagos",
        investment_notes:
          "Las líneas y totales resumen los servicios de esta propuesta. Cargos únicos y recurrentes están indicados en cada fila.",
        payment_notes:
          "Depósito y cuotas siguen el calendario abajo salvo que tu contrato indique otra cosa.",
      },
    },
  },
};

export const LEGACY_WARRANTY_TITLES = new Set([
  "Work with confidence",
  "Trabaja con confianza",
]);

export const stripLegacyWarranty = (
  content: ProposalDocumentContent,
): ProposalDocumentContent => {
  const title = content.warranty_title?.trim() ?? "";
  if (!LEGACY_WARRANTY_TITLES.has(title)) return content;
  return {
    ...content,
    warranty_title: "",
    warranty_body: "",
    locales: content.locales?.es
      ? {
          ...content.locales,
          es: {
            ...content.locales.es,
            warranty_title: "",
            warranty_body: "",
          },
        }
      : content.locales,
  };
};

export const mergeCommercialCopyFromPreset = (
  slug: ProposalDeckPresetId,
  content: ProposalDocumentContent,
): ProposalDocumentContent => {
  const commercial = PROPOSAL_COMMERCIAL_COPY_BY_PRESET[slug];
  if (!commercial) return stripLegacyWarranty(content);

  const next: ProposalDocumentContent = {
    ...content,
    investment_title:
      content.investment_title?.trim() ||
      commercial.investment_title ||
      content.investment_title,
    investment_notes:
      content.investment_notes?.trim() ||
      commercial.investment_notes ||
      content.investment_notes,
    payment_notes:
      content.payment_notes?.trim() ||
      commercial.payment_notes ||
      content.payment_notes,
  };

  if (commercial.locales?.es) {
    next.locales = {
      ...content.locales,
      es: {
        ...content.locales?.es,
        investment_title:
          content.locales?.es?.investment_title?.trim() ||
          commercial.locales.es.investment_title,
        investment_notes:
          content.locales?.es?.investment_notes?.trim() ||
          commercial.locales.es.investment_notes,
        payment_notes:
          content.locales?.es?.payment_notes?.trim() ||
          commercial.locales.es.payment_notes,
      },
    };
  }

  return stripLegacyWarranty(next);
};
