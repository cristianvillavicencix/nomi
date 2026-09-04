import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { CONTRACTOR_BRIEF_FORM_SCHEMA } from "@/modules/deals/contractorBriefSchema";
import {
  ESSENTIAL_BRIEF_REQUEST,
  buildBriefSectionsParam,
  parseBriefSectionsParam,
} from "@/modules/deals/projectBriefRequestScope";
import {
  FormBrandingShell,
} from "@/modules/forms/public/FormBrandingShell";
import {
  ProjectBriefPublicForm,
} from "@/modules/forms/public/PublicFormRenderer";
import {
  PublicFormEmbedProvider,
  publicFormContentClassName,
} from "@/modules/forms/public/PublicFormEmbedProvider";
import { ProjectBriefThankYou } from "@/modules/forms/public/ProjectBriefThankYou";
import type { PublicFormPayload } from "@/modules/forms/types";

const MOCK_PREFILL: Record<string, unknown> = {
  project_type: "website",
  contact_first_name: "Alex",
  contact_last_name: "Rivera",
  contact_email: "alex@acmeroofing.example",
  contact_phone: "+15551234567",
  company_name: "Acme Roofing Co.",
  business_phone: "+15551234567",
  full_address: "123 Main St, Austin, TX 78701",
  existing_website: "https://acmeroofing.example",
  use_same_contact_for_business: true,
};

const isPreviewAllowed = (keyFromQuery: string | null) => {
  if (import.meta.env.DEV) return true;
  const expected = String(import.meta.env.VITE_BRIEF_PREVIEW_KEY ?? "").trim();
  if (!expected) return false;
  return Boolean(keyFromQuery && keyFromQuery === expected);
};

const buildPreviewPayload = (): PublicFormPayload => ({
  token: "preview",
  is_preview: true,
  form: {
    id: 0,
    name: "Project brief",
    slug: "project_brief",
    type: "project_brief",
    schema: CONTRACTOR_BRIEF_FORM_SCHEMA,
    logo_url: "/logos/sigma.png",
    agency_name: "Latino Business Support",
    agency_phone: "4752570243",
    agency_email: "info@lbs.bz",
    agency_address: "1200 Summer St, Stamford, CT 06902",
    agency_website: "https://lbs.bz",
    welcome_title: "Thank you for your trust",
    welcome_message:
      "Thanks for choosing Latino Business Support. We’re excited to build your website with you. This short brief helps us get the details right — many answers are already filled in, and it only takes a few minutes.",
    honeypot_enabled: false,
    recaptcha_enabled: false,
  },
  prefill: MOCK_PREFILL,
});

/**
 * Staff/dev preview of the client website brief wizard.
 * `/forms/preview/website-brief?sections=confirm_data` (etc.)
 */
export const WebsiteBriefPreviewPage = () => {
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState<{
    thank_you_title?: string;
    thank_you_message?: string;
    preview?: boolean;
  } | null>(null);

  const allowed = isPreviewAllowed(searchParams.get("key"));
  const sectionsParam = searchParams.get("sections");
  const scopedSections = useMemo(() => {
    const parsed = parseBriefSectionsParam(sectionsParam);
    return parsed?.length ? parsed : ESSENTIAL_BRIEF_REQUEST.sections;
  }, [sectionsParam]);

  const payload = useMemo(() => buildPreviewPayload(), []);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  // Ensure URL always has sections for the public form reader
  if (!sectionsParam?.trim()) {
    const next = new URLSearchParams(searchParams);
    next.set("sections", buildBriefSectionsParam(scopedSections));
    return (
      <Navigate
        to={`/forms/preview/website-brief?${next.toString()}`}
        replace
      />
    );
  }

  if (submitted) {
    return (
      <PublicFormEmbedProvider>
        <FormBrandingShell embedded={false} className={publicFormContentClassName(false)}>
          <ProjectBriefThankYou
            embedded={false}
            preview
            className={publicFormContentClassName(false)}
          />
        </FormBrandingShell>
      </PublicFormEmbedProvider>
    );
  }

  return (
    <PublicFormEmbedProvider>
      <ProjectBriefPublicForm
        payload={payload}
        onSubmitted={(result) => setSubmitted(result)}
      />
    </PublicFormEmbedProvider>
  );
};
