import { Route, Navigate } from "react-router";
import { isLbsMode } from "@/lbs/productMode";
import { LeadsListPage } from "@/lbs/leads/LeadsListPage";
import { ClientsListPage } from "@/lbs/clients/ClientsListPage";
import { ClientShowPage } from "@/lbs/clients/ClientShowPage";
import { ClientEditPage } from "@/lbs/clients/ClientEditPage";
import { FindDuplicatesPage } from "@/lbs/clients/FindDuplicatesPage";
import { LeadCreatePage } from "@/lbs/leads/LeadCreatePage";
import { LeadShowPage } from "@/lbs/leads/LeadShowPage";
import { LbsContactShowPage } from "@/lbs/contacts/ContactShowPage";
import { TicketCreate } from "@/lbs/tickets/TicketCreate";
import { FormPublicEntry } from "@/lbs/forms-v2/public/FormPublicEntry";
import { ShortUrlRedirect } from "@/lbs/forms-v2/public/ShortUrlRedirect";
import { PublicProposalPage } from "@/lbs/proposals/public/PublicProposalPage";
import { ProposalShortUrlRedirect } from "@/lbs/proposals/public/ProposalShortUrlRedirect";
import { PortalShortUrlRedirect } from "@/lbs/portal/PortalShortUrlRedirect";
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
  CompanyToClientEditRedirect,
  CompanyToClientShowRedirect,
} from "@/lbs/CompanyRouteRedirects";

type ProtectedRouteProps = {
  resource: string;
  action: string;
  children: JSX.Element;
};

export const renderLbsPublicFormRoute = () => (
  <>
    <Route path="/f/:shortCode" element={<ShortUrlRedirect />} />
    <Route path="/pr/:shortCode" element={<ProposalShortUrlRedirect />} />
    <Route path="/proposal/:token" element={<PublicProposalPage />} />
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
  if (!isLbsMode()) {
    return null;
  }

  return (
    <>
      <Route path="/contacts" element={<Navigate to="/clients" replace />} />
      <Route
        path="/contacts/create"
        element={<Navigate to="/leads/create" replace />}
      />
      <Route path="/companies" element={<Navigate to="/clients" replace />} />
      <Route
        path="/companies/create"
        element={<Navigate to="/clients?create=company" replace />}
      />
      <Route
        path="/companies/:id/show"
        element={<CompanyToClientShowRedirect />}
      />
      <Route
        path="/companies/:id/show/:tab"
        element={<CompanyToClientShowRedirect />}
      />
      <Route
        path="/companies/:id/edit"
        element={<CompanyToClientEditRedirect />}
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
        element={<Navigate to="/clients?create=company" replace />}
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute resource="companies" action="list">
            <ClientsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/find-duplicates"
        element={
          <ProtectedRoute resource="contacts" action="edit">
            <FindDuplicatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id/show"
        element={
          <ProtectedRoute resource="companies" action="list">
            <ClientShowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id/edit"
        element={
          <ProtectedRoute resource="companies" action="edit">
            <ClientEditPage />
          </ProtectedRoute>
        }
      />
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
