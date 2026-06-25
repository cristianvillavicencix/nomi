import { Route, Navigate } from "react-router";
import { LeadsListPage } from "@/modules/leads/LeadsListPage";
import { ClientShowPage } from "@/modules/clients/ClientShowPage";
import { ClientsHubPage } from "@/modules/clients/ClientsHubPage";
import { ClientsHubRoute } from "@/modules/clients/ClientsHubRoute";
import {
  LegacyClientEditRedirect,
  LegacyClientIdRedirect,
  LegacyClientShowRedirect,
} from "@/modules/clients/ClientRouteRedirects";
import { FindDuplicatesPage } from "@/modules/clients/FindDuplicatesPage";
import { LeadCreatePage } from "@/modules/leads/LeadCreatePage";
import { LeadShowPage } from "@/modules/leads/LeadShowPage";
import { LbsContactShowPage } from "@/modules/contacts/ContactShowPage";
import { TicketCreate } from "@/modules/tickets/TicketCreate";
import { PublicBookingPage } from "@/modules/booking/public/PublicBookingPage";
import { BookingShortUrlRedirect } from "@/modules/booking/public/BookingShortUrlRedirect";
import { FormPublicEntry } from "@/modules/forms/public/FormPublicEntry";
import { ShortUrlRedirect } from "@/modules/forms/public/ShortUrlRedirect";
import { PublicProposalPage } from "@/modules/proposals/public/PublicProposalPage";
import { PublicProposalAcceptPageWithLocale } from "@/modules/proposals/public/PublicProposalAcceptPage";
import { ProposalShortUrlRedirect } from "@/modules/proposals/public/ProposalShortUrlRedirect";
import { PublicInvoicePage } from "@/modules/billing/public/PublicInvoicePage";
import { InvoiceShortUrlRedirect } from "@/modules/billing/public/InvoiceShortUrlRedirect";
import { PortalShortUrlRedirect } from "@/modules/portal/PortalShortUrlRedirect";
import { ClientPortalPage } from "@/modules/portal/ClientPortalPage";
import { ClientPortalInvoicePage } from "@/modules/portal/ClientPortalInvoicePage";
import { PublicShareLayout } from "@/app/PublicShareLayout";
import { FormsListPage } from "@/modules/forms/FormsListPage";
import { FormBuilderPage } from "@/modules/forms/builder/FormBuilderPage";
import { SubmissionsListPage } from "@/modules/forms/submissions/SubmissionsListPage";
import { SubmissionDetailPage } from "@/modules/forms/submissions/SubmissionDetailPage";
import { FormAnalyticsPage } from "@/modules/forms/analytics/FormAnalyticsPage";
import { ProposalsList } from "@/modules/proposals/ProposalsList";
import { ProposalCreate } from "@/modules/proposals/ProposalCreate";
import { ProposalEdit } from "@/modules/proposals/ProposalEdit";
import { ProposalViewPage } from "@/modules/proposals/ProposalViewPage";
import { ProposalClientPreviewRoute } from "@/modules/proposals/document/ProposalClientPreviewRoute";
import { ProposalPreviewPage } from "@/modules/proposals/document/ProposalPreviewPage";
import { ContractsList } from "@/modules/contracts/ContractsList";
import { ContractShow } from "@/modules/contracts/ContractShow";
import { ClientBillingPage } from "@/modules/billing/ClientBillingPage";
import { StandaloneInvoiceCreatePage } from "@/modules/billing/StandaloneInvoiceCreatePage";
import { InvoiceWorkspaceRedirect } from "@/modules/billing/InvoiceRouteRedirects";
import { TicketsList } from "@/modules/tickets/TicketsList";
import { TicketShow } from "@/modules/tickets/TicketShow";
import { lazy, Suspense } from "react";
import { CalendarPage } from "@/modules/calendar/CalendarPage";
import { MeetingsPage } from "@/modules/meetings/MeetingsPage";
import { WebsiteMonitorQuickCheckPage } from "@/modules/web-monitor/WebsiteMonitorQuickCheckPage";
const MessagesPage = lazy(() =>
  import("@/modules/messages/MessagesPage").then((module) => ({
    default: module.MessagesPage,
  })),
);
import {
  LegacyCompanyCreateRedirect,
  LegacyCompanyEditRedirect,
  LegacyCompanyShowRedirect,
} from "@/modules/clients/CompanyRouteRedirects";

type ProtectedRouteProps = {
  resource: string;
  action: string;
  children: JSX.Element;
};

const ClientsHubList = () => (
  <ClientsHubRoute>
    <ClientsHubPage />
  </ClientsHubRoute>
);

export const renderLbsPublicPortalRoutes = () => (
  <Route element={<PublicShareLayout />}>
    <Route path="/portal" element={<ClientPortalPage />} />
    <Route
      path="/portal/invoice/:token"
      element={<ClientPortalInvoicePage />}
    />
  </Route>
);

export const renderLbsPublicFormRoute = () => (
  <Route element={<PublicShareLayout />}>
    <Route path="/b/:shortCode" element={<BookingShortUrlRedirect />} />
    <Route path="/book/:token" element={<PublicBookingPage />} />
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
  </Route>
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
            <ClientsHubList />
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
            <ClientsHubList />
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
            <WebsiteMonitorQuickCheckPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/create"
        element={<Navigate to="/clients?create=company" replace />}
      />
      <Route
        path="/clients"
        element={<ClientsHubList />}
      />
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
            <InvoiceWorkspaceRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/:id/edit"
        element={
          <ProtectedRoute resource="client_invoices" action="edit">
            <InvoiceWorkspaceRedirect />
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
    </>
  );
};

/** @deprecated Use renderLbsCustomRoutes() inline inside <CustomRoutes>, not as JSX. */
export const LbsCustomRoutes = renderLbsCustomRoutes;
