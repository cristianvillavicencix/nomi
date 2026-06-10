import { Route, Navigate } from "react-router";
import { LeadsListPage } from "@/lbs/leads/LeadsListPage";
import { CompaniesListPage } from "@/lbs/clients/CompaniesListPage";
import { ContactsListPage } from "@/lbs/clients/ContactsListPage";
import { ClientShowPage } from "@/lbs/clients/ClientShowPage";
import {
  LegacyClientEditRedirect,
  LegacyClientIdRedirect,
  LegacyClientShowRedirect,
  LegacyClientsListRedirect,
} from "@/lbs/clients/ClientRouteRedirects";
import { FindDuplicatesPage } from "@/lbs/clients/FindDuplicatesPage";
import { LeadCreatePage } from "@/lbs/leads/LeadCreatePage";
import { LeadShowPage } from "@/lbs/leads/LeadShowPage";
import { LbsContactShowPage } from "@/lbs/contacts/ContactShowPage";
import { TicketCreate } from "@/lbs/tickets/TicketCreate";
import { FormPublicEntry } from "@/lbs/forms-v2/public/FormPublicEntry";
import { ShortUrlRedirect } from "@/lbs/forms-v2/public/ShortUrlRedirect";
import { PublicProposalPage } from "@/lbs/proposals/public/PublicProposalPage";
import { PublicProposalAcceptPageWithLocale } from "@/lbs/proposals/public/PublicProposalAcceptPage";
import { ProposalShortUrlRedirect } from "@/lbs/proposals/public/ProposalShortUrlRedirect";
import { PublicInvoicePage } from "@/lbs/billing/public/PublicInvoicePage";
import { InvoiceShortUrlRedirect } from "@/lbs/billing/public/InvoiceShortUrlRedirect";
import { PortalShortUrlRedirect } from "@/lbs/portal/PortalShortUrlRedirect";
import { ClientPortalPage } from "@/lbs/portal/ClientPortalPage";
import { ClientPortalInvoicePage } from "@/lbs/portal/ClientPortalInvoicePage";
import { FormsListPage } from "@/lbs/forms-v2/FormsListPage";
import { FormBuilderPage } from "@/lbs/forms-v2/builder/FormBuilderPage";
import { SubmissionsListPage } from "@/lbs/forms-v2/submissions/SubmissionsListPage";
import { SubmissionDetailPage } from "@/lbs/forms-v2/submissions/SubmissionDetailPage";
import { FormAnalyticsPage } from "@/lbs/forms-v2/analytics/FormAnalyticsPage";
import {
  ContractsPlaceholderPage,
  ProposalsPlaceholderPage,
  TicketsPlaceholderPage,
} from "@/lbs/placeholders";
import { ProposalsList } from "@/lbs/proposals/ProposalsList";
import { ProposalCreate } from "@/lbs/proposals/ProposalCreate";
import { ProposalEdit } from "@/lbs/proposals/ProposalEdit";
import { ProposalViewPage } from "@/lbs/proposals/ProposalViewPage";
import { ProposalClientPreviewRoute } from "@/lbs/proposals/document/ProposalClientPreviewRoute";
import { ProposalPreviewPage } from "@/lbs/proposals/document/ProposalPreviewPage";
import { ContractsList } from "@/lbs/contracts/ContractsList";
import { ContractShow } from "@/lbs/contracts/ContractShow";
import { ClientBillingPage } from "@/lbs/billing/ClientBillingPage";
import { StandaloneInvoiceCreatePage } from "@/lbs/billing/StandaloneInvoiceCreatePage";
import { StandaloneInvoiceShowPage } from "@/lbs/billing/StandaloneInvoiceShowPage";
import { StandaloneInvoiceEditPage } from "@/lbs/billing/StandaloneInvoiceEditPage";
import { TicketsList } from "@/lbs/tickets/TicketsList";
import { TicketShow } from "@/lbs/tickets/TicketShow";
import { lazy, Suspense } from "react";
import { CalendarPage } from "@/lbs/calendar/CalendarPage";
import { MeetingsPage } from "@/lbs/meetings/MeetingsPage";
import { WebsiteMonitorListPage } from "@/lbs/website-monitor/WebsiteMonitorListPage";
import { WebsiteMonitorShowPage } from "@/lbs/website-monitor/WebsiteMonitorShowPage";
import { WebsiteAuditReportPage } from "@/lbs/website-monitor/audit/WebsiteAuditReportPage";
const MessagesPage = lazy(() =>
  import("@/lbs/messages/MessagesPage").then((module) => ({
    default: module.MessagesPage,
  })),
);
import {
  LegacyCompanyCreateRedirect,
  LegacyCompanyEditRedirect,
  LegacyCompanyShowRedirect,
} from "@/lbs/CompanyRouteRedirects";

type ProtectedRouteProps = {
  resource: string;
  action: string;
  children: JSX.Element;
};

export const renderLbsPublicPortalRoutes = () => (
  <>
    <Route path="/portal" element={<ClientPortalPage />} />
    <Route
      path="/portal/invoice/:token"
      element={<ClientPortalInvoicePage />}
    />
  </>
);

export const renderLbsPublicFormRoute = () => (
  <>
    <Route path="/f/:shortCode" element={<ShortUrlRedirect />} />
    <Route path="/pr/:shortCode" element={<ProposalShortUrlRedirect />} />
    <Route path="/iv/:shortCode" element={<InvoiceShortUrlRedirect />} />
    <Route path="/invoice/:token" element={<PublicInvoicePage />} />
    <Route path="/proposal/:token" element={<PublicProposalPage />} />
    <Route
      path="/proposal/:token/accept"
      element={<PublicProposalAcceptPageWithLocale />}
    />
    <Route path="/p/:shortCode" element={<PortalShortUrlRedirect />} />
    <Route path="/forms/:slug" element={<FormPublicEntry />} />
  </>
);

/** Staff client preview — no CRM sidebar (CustomRoutes noLayout). */
export const renderLbsProposalClientPreviewRoute = () => (
  <Route
    path="/proposals/:id/client-preview"
    element={<ProposalClientPreviewRoute />}
  />
);

export const renderLbsCustomRoutes = ({
  ProtectedRoute,
}: {
  ProtectedRoute: (props: ProtectedRouteProps) => JSX.Element;
}) => {
  return (
    <>
      <Route path="/contacts/create" element={<Navigate to="/contacts?create=contact" replace />} />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute resource="contacts" action="list">
            <ContactsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/create"
        element={<LegacyCompanyCreateRedirect />}
      />
      <Route
        path="/companies/find-duplicates"
        element={
          <ProtectedRoute resource="contacts" action="edit">
            <FindDuplicatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies/:id/edit"
        element={<LegacyCompanyEditRedirect />}
      />
      <Route
        path="/companies/:id/show/:tab"
        element={<LegacyCompanyShowRedirect />}
      />
      <Route
        path="/companies/:id/show"
        element={<LegacyCompanyShowRedirect />}
      />
      <Route
        path="/companies/:id"
        element={
          <ProtectedRoute resource="companies" action="list">
            <ClientShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies"
        element={
          <ProtectedRoute resource="companies" action="list">
            <CompaniesListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute resource="tasks" action="list">
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings"
        element={
          <ProtectedRoute resource="tasks" action="list">
            <MeetingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute resource="conversations" action="list">
            <Suspense
              fallback={
                <div className="p-6 text-sm text-muted-foreground">
                  Loading messages…
                </div>
              }
            >
              <MessagesPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/create"
        element={
          <ProtectedRoute resource="contacts" action="create">
            <LeadCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute resource="contacts" action="list">
            <LeadsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/:id/show"
        element={
          <ProtectedRoute resource="contacts" action="list">
            <LeadShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts/:id/show"
        element={
          <ProtectedRoute resource="contacts" action="list">
            <LbsContactShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-monitor"
        element={
          <ProtectedRoute resource="monitored_websites" action="list">
            <WebsiteMonitorListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-monitor/:id/show"
        element={
          <ProtectedRoute resource="monitored_websites" action="show">
            <WebsiteMonitorShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-monitor/:siteId/audit/:auditId"
        element={
          <ProtectedRoute resource="monitored_websites" action="show">
            <WebsiteAuditReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/create"
        element={<Navigate to="/companies?create=company" replace />}
      />
      <Route path="/clients" element={<LegacyClientsListRedirect />} />
      <Route
        path="/clients/find-duplicates"
        element={<Navigate to="/companies/find-duplicates" replace />}
      />
      <Route path="/clients/:id/show" element={<LegacyClientShowRedirect />} />
      <Route path="/clients/:id/edit" element={<LegacyClientEditRedirect />} />
      <Route path="/clients/:id" element={<LegacyClientIdRedirect />} />
      <Route
        path="/tickets/create"
        element={
          <ProtectedRoute resource="tickets" action="create">
            <TicketCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals"
        element={
          <ProtectedRoute resource="proposals" action="list">
            <ProposalsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/create"
        element={
          <ProtectedRoute resource="proposals" action="create">
            <ProposalCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/show"
        element={
          <ProtectedRoute resource="proposals" action="show">
            <ProposalViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/edit"
        element={
          <ProtectedRoute resource="proposals" action="edit">
            <ProposalEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/preview"
        element={
          <ProtectedRoute resource="proposals" action="edit">
            <ProposalPreviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts"
        element={
          <ProtectedRoute resource="contracts" action="list">
            <ContractsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute resource="proposal_payment_installments" action="list">
            <ClientBillingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/new"
        element={
          <ProtectedRoute resource="client_invoices" action="create">
            <StandaloneInvoiceCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/:id/show"
        element={
          <ProtectedRoute resource="client_invoices" action="show">
            <StandaloneInvoiceShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/:id/edit"
        element={
          <ProtectedRoute resource="client_invoices" action="edit">
            <StandaloneInvoiceEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts/:id/show"
        element={
          <ProtectedRoute resource="contracts" action="show">
            <ContractShow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2"
        element={
          <ProtectedRoute resource="forms" action="list">
            <FormsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/new"
        element={
          <ProtectedRoute resource="forms" action="create">
            <FormBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/:id/edit"
        element={
          <ProtectedRoute resource="forms" action="edit">
            <FormBuilderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/submissions/:id"
        element={
          <ProtectedRoute resource="forms" action="list">
            <SubmissionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/submissions"
        element={
          <ProtectedRoute resource="forms" action="list">
            <SubmissionsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/:id/analytics"
        element={
          <ProtectedRoute resource="forms" action="list">
            <FormAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/web-forms" element={<Navigate to="/forms-v2" replace />} />
      <Route path="/web-forms/*" element={<Navigate to="/forms-v2" replace />} />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute resource="tickets" action="list">
            <TicketsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/:id/show"
        element={
          <ProtectedRoute resource="tickets" action="show">
            <TicketShow />
          </ProtectedRoute>
        }
      />
      {/* Legacy placeholder routes kept for direct links during rollout */}
      <Route
        path="/proposals-placeholder"
        element={<ProposalsPlaceholderPage />}
      />
      <Route
        path="/contracts-placeholder"
        element={<ContractsPlaceholderPage />}
      />
      <Route path="/tickets-placeholder" element={<TicketsPlaceholderPage />} />
    </>
  );
};

/** @deprecated Use renderLbsCustomRoutes() inline inside <CustomRoutes>, not as JSX. */
export const LbsCustomRoutes = renderLbsCustomRoutes;
