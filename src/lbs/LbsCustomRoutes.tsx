import { Route, Navigate } from "react-router";
import { isLbsMode } from "@/lbs/productMode";
import { LeadsListPage } from "@/lbs/leads/LeadsListPage";
import { ClientsListPage } from "@/lbs/clients/ClientsListPage";
import { ClientShowPage } from "@/lbs/clients/ClientShowPage";
import { ClientCreatePage } from "@/lbs/clients/ClientCreatePage";
import { ClientEditPage } from "@/lbs/clients/ClientEditPage";
import { LeadCreatePage } from "@/lbs/leads/LeadCreatePage";
import { LeadShowPage } from "@/lbs/leads/LeadShowPage";
import { LbsContactShowPage } from "@/lbs/contacts/ContactShowPage";
import { TicketCreate } from "@/lbs/tickets/TicketCreate";
import { FormPublicEntry } from "@/lbs/forms-v2/public/FormPublicEntry";
import { ShortUrlRedirect } from "@/lbs/forms-v2/public/ShortUrlRedirect";
import { FormsListPage } from "@/lbs/forms-v2/FormsListPage";
import { FormBuilderPage } from "@/lbs/forms-v2/builder/FormBuilderPage";
import { SubmissionsListPage } from "@/lbs/forms-v2/submissions/SubmissionsListPage";
import {
  ContractsPlaceholderPage,
  ProposalsPlaceholderPage,
  TicketsPlaceholderPage,
  WebFormsPlaceholderPage,
} from "@/lbs/placeholders";
import { ProposalsList } from "@/lbs/proposals/ProposalsList";
import { ProposalCreate } from "@/lbs/proposals/ProposalCreate";
import { ProposalShow } from "@/lbs/proposals/ProposalShow";
import { ContractsList } from "@/lbs/contracts/ContractsList";
import { ContractShow } from "@/lbs/contracts/ContractShow";
import { WebFormsList } from "@/lbs/web-forms/WebFormsList";
import { WebFormShow } from "@/lbs/web-forms/WebFormShow";
import { WebFormEdit } from "@/lbs/web-forms/WebFormEdit";
import { WebFormCreate } from "@/lbs/web-forms/WebFormCreate";
import { TicketsList } from "@/lbs/tickets/TicketsList";
import { TicketShow } from "@/lbs/tickets/TicketShow";
import { lazy, Suspense } from "react";
import { CalendarPage } from "@/lbs/calendar/CalendarPage";
import { MeetingsPage } from "@/lbs/meetings/MeetingsPage";
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
    <Route path="/forms/:slug" element={<FormPublicEntry />} />
  </>
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
        element={<Navigate to="/clients/create" replace />}
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
        path="/clients/create"
        element={
          <ProtectedRoute resource="companies" action="create">
            <ClientCreatePage />
          </ProtectedRoute>
        }
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
            <ProposalShow />
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
        path="/forms-v2/submissions"
        element={
          <ProtectedRoute resource="forms" action="list">
            <SubmissionsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-forms"
        element={
          <ProtectedRoute resource="forms" action="list">
            <WebFormsList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-forms/create"
        element={
          <ProtectedRoute resource="forms" action="create">
            <WebFormCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-forms/:id/show"
        element={
          <ProtectedRoute resource="forms" action="show">
            <WebFormShow />
          </ProtectedRoute>
        }
      />
      <Route
        path="/web-forms/:id/edit"
        element={
          <ProtectedRoute resource="forms" action="edit">
            <WebFormEdit />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/web-forms-placeholder"
        element={<WebFormsPlaceholderPage />}
      />
      <Route path="/tickets-placeholder" element={<TicketsPlaceholderPage />} />
    </>
  );
};

/** @deprecated Use renderLbsCustomRoutes() inline inside <CustomRoutes>, not as JSX. */
export const LbsCustomRoutes = renderLbsCustomRoutes;
