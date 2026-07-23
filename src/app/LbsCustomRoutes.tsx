import { lazy, Suspense, type ReactNode } from "react";
import { Route, Navigate } from "react-router";
import { LeadsListPage } from "@/modules/leads/LeadsListPage";
import { ClientShowPage } from "@/modules/clients/ClientShowPage";
import { ClientsHubPage } from "@/modules/clients/ClientsHubPage";
import { ClientsHubRoute } from "@/modules/clients/ClientsHubRoute";
import { AccountsHubPage } from "@/modules/accounts/AccountsHubPage";
import { AccountsHubRoute } from "@/modules/accounts/AccountsHubRoute";
import {
  ClientsHubToAccountsRedirect,
  LeadsListToAccountsRedirect,
  ListAliasToAccountsRedirect,
} from "@/modules/accounts/AccountsHubRedirects";
import {
  LegacyClientEditRedirect,
  LegacyClientIdRedirect,
  LegacyClientShowRedirect,
} from "@/modules/clients/ClientRouteRedirects";
import { FindDuplicatesPage } from "@/modules/clients/FindDuplicatesPage";
import { LeadCreatePage } from "@/modules/leads/LeadCreatePage";
import { LeadShowPage } from "@/modules/leads/LeadShowPage";
import { LbsContactShowPage } from "@/modules/contacts/ContactShowPage";
import { PublicShareLayout } from "@/app/PublicShareLayout";
import { LazyRouteFallback } from "@/app/LazyRouteFallback";
import { isAccountsHubEnabled } from "@/lib/featureFlags";
import {
  LegacyCompanyCreateRedirect,
  LegacyCompanyEditRedirect,
  LegacyCompanyShowRedirect,
} from "@/modules/clients/CompanyRouteRedirects";

const MessagesPage = lazy(() =>
  import("@/modules/messages/MessagesPage").then((module) => ({
    default: module.MessagesPage,
  })),
);
const MailPage = lazy(() =>
  import("@/modules/mail/MailPage").then((module) => ({
    default: module.MailPage,
  })),
);
const TicketCreate = lazy(() =>
  import("@/modules/tickets/TicketCreate").then((module) => ({
    default: module.TicketCreate,
  })),
);
const TicketsOverview = lazy(() =>
  import("@/modules/tickets/TicketsOverview").then((module) => ({
    default: module.TicketsOverview,
  })),
);
const TicketShow = lazy(() =>
  import("@/modules/tickets/TicketShow").then((module) => ({
    default: module.TicketShow,
  })),
);
const ClientBillingPage = lazy(() =>
  import("@/modules/billing/ClientBillingPage").then((module) => ({
    default: module.ClientBillingPage,
  })),
);
const StandaloneInvoiceCreatePage = lazy(() =>
  import("@/modules/billing/StandaloneInvoiceCreatePage").then((module) => ({
    default: module.StandaloneInvoiceCreatePage,
  })),
);
const InvoiceWorkspaceRedirect = lazy(() =>
  import("@/modules/billing/InvoiceRouteRedirects").then((module) => ({
    default: module.InvoiceWorkspaceRedirect,
  })),
);
const ProposalsList = lazy(() =>
  import("@/modules/proposals/ProposalsList").then((module) => ({
    default: module.ProposalsList,
  })),
);
const ProposalCreate = lazy(() =>
  import("@/modules/proposals/ProposalCreate").then((module) => ({
    default: module.ProposalCreate,
  })),
);
const ProposalEdit = lazy(() =>
  import("@/modules/proposals/ProposalEdit").then((module) => ({
    default: module.ProposalEdit,
  })),
);
const ProposalViewPage = lazy(() =>
  import("@/modules/proposals/ProposalViewPage").then((module) => ({
    default: module.ProposalViewPage,
  })),
);
const ProposalPreviewPage = lazy(() =>
  import("@/modules/proposals/document/ProposalPreviewPage").then((module) => ({
    default: module.ProposalPreviewPage,
  })),
);
const ProposalClientPreviewRoute = lazy(() =>
  import("@/modules/proposals/document/ProposalClientPreviewRoute").then(
    (module) => ({
      default: module.ProposalClientPreviewRoute,
    }),
  ),
);
const ContractsList = lazy(() =>
  import("@/modules/contracts/ContractsList").then((module) => ({
    default: module.ContractsList,
  })),
);
const ContractShow = lazy(() =>
  import("@/modules/contracts/ContractShow").then((module) => ({
    default: module.ContractShow,
  })),
);
const FormsListPage = lazy(() =>
  import("@/modules/forms/FormsListPage").then((module) => ({
    default: module.FormsListPage,
  })),
);
const FormBuilderPage = lazy(() =>
  import("@/modules/forms/builder/FormBuilderPage").then((module) => ({
    default: module.FormBuilderPage,
  })),
);
const SubmissionsListPage = lazy(() =>
  import("@/modules/forms/submissions/SubmissionsListPage").then((module) => ({
    default: module.SubmissionsListPage,
  })),
);
const SubmissionDetailPage = lazy(() =>
  import("@/modules/forms/submissions/SubmissionDetailPage").then((module) => ({
    default: module.SubmissionDetailPage,
  })),
);
const FormAnalyticsPage = lazy(() =>
  import("@/modules/forms/analytics/FormAnalyticsPage").then((module) => ({
    default: module.FormAnalyticsPage,
  })),
);
const CalendarPage = lazy(() =>
  import("@/modules/calendar/CalendarPage").then((module) => ({
    default: module.CalendarPage,
  })),
);
const MeetingsPage = lazy(() =>
  import("@/modules/meetings/MeetingsPage").then((module) => ({
    default: module.MeetingsPage,
  })),
);
const MarketingHubPage = lazy(() =>
  import("@/modules/marketing/MarketingHubPage").then((module) => ({
    default: module.MarketingHubPage,
  })),
);
const WebsiteMonitorQuickCheckPage = lazy(() =>
  import("@/modules/web-monitor/WebsiteMonitorQuickCheckPage").then(
    (module) => ({
      default: module.WebsiteMonitorQuickCheckPage,
    }),
  ),
);
const HostingerHubPage = lazy(() =>
  import("@/modules/hostinger/HostingerHubPage").then((module) => ({
    default: module.HostingerHubPage,
  })),
);
const PublicBookingPage = lazy(() =>
  import("@/modules/booking/public/PublicBookingPage").then((module) => ({
    default: module.PublicBookingPage,
  })),
);
const BookingShortUrlRedirect = lazy(() =>
  import("@/modules/booking/public/BookingShortUrlRedirect").then((module) => ({
    default: module.BookingShortUrlRedirect,
  })),
);
const PublicCalendarEventPage = lazy(() =>
  import("@/modules/meetings/public/PublicCalendarEventPage").then((module) => ({
    default: module.PublicCalendarEventPage,
  })),
);
const FormPublicEntry = lazy(() =>
  import("@/modules/forms/public/FormPublicEntry").then((module) => ({
    default: module.FormPublicEntry,
  })),
);
const ShortUrlRedirect = lazy(() =>
  import("@/modules/forms/public/ShortUrlRedirect").then((module) => ({
    default: module.ShortUrlRedirect,
  })),
);
const PublicProposalPage = lazy(() =>
  import("@/modules/proposals/public/PublicProposalPage").then((module) => ({
    default: module.PublicProposalPage,
  })),
);
const PublicProposalAcceptPageWithLocale = lazy(() =>
  import("@/modules/proposals/public/PublicProposalAcceptPage").then(
    (module) => ({
      default: module.PublicProposalAcceptPageWithLocale,
    }),
  ),
);
const ProposalShortUrlRedirect = lazy(() =>
  import("@/modules/proposals/public/ProposalShortUrlRedirect").then(
    (module) => ({
      default: module.ProposalShortUrlRedirect,
    }),
  ),
);
const PublicInvoicePage = lazy(() =>
  import("@/modules/billing/public/PublicInvoicePage").then((module) => ({
    default: module.PublicInvoicePage,
  })),
);
const InvoiceShortUrlRedirect = lazy(() =>
  import("@/modules/billing/public/InvoiceShortUrlRedirect").then((module) => ({
    default: module.InvoiceShortUrlRedirect,
  })),
);
const PortalShortUrlRedirect = lazy(() =>
  import("@/modules/portal/PortalShortUrlRedirect").then((module) => ({
    default: module.PortalShortUrlRedirect,
  })),
);
const ClientPortalPage = lazy(() =>
  import("@/modules/portal/ClientPortalPage").then((module) => ({
    default: module.ClientPortalPage,
  })),
);
const ClientPortalInvoicePage = lazy(() =>
  import("@/modules/portal/ClientPortalInvoicePage").then((module) => ({
    default: module.ClientPortalInvoicePage,
  })),
);

const LazyRoute = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Suspense fallback={<LazyRouteFallback label={label} />}>{children}</Suspense>
);

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

const AccountsHubList = () => (
  <AccountsHubRoute>
    <AccountsHubPage />
  </AccountsHubRoute>
);

const accountsHub = isAccountsHubEnabled();

export const renderLbsPublicPortalRoutes = () => (
  <Route element={<PublicShareLayout />}>
    <Route
      path="/portal"
      element={
        <LazyRoute label="Loading portal…">
          <ClientPortalPage />
        </LazyRoute>
      }
    />
    <Route
      path="/portal/invoice/:token"
      element={
        <LazyRoute label="Loading invoice…">
          <ClientPortalInvoicePage />
        </LazyRoute>
      }
    />
  </Route>
);

export const renderLbsPublicFormRoute = () => (
  <Route element={<PublicShareLayout />}>
    <Route
      path="/b/:shortCode"
      element={
        <LazyRoute label="Loading…">
          <BookingShortUrlRedirect />
        </LazyRoute>
      }
    />
    <Route
      path="/book/:token"
      element={
        <LazyRoute label="Loading booking…">
          <PublicBookingPage />
        </LazyRoute>
      }
    />
    <Route
      path="/c/:shortCode"
      element={
        <LazyRoute label="Loading event…">
          <PublicCalendarEventPage />
        </LazyRoute>
      }
    />
    <Route
      path="/cal/:token"
      element={
        <LazyRoute label="Loading event…">
          <PublicCalendarEventPage />
        </LazyRoute>
      }
    />
    <Route
      path="/f/:shortCode"
      element={
        <LazyRoute label="Loading…">
          <ShortUrlRedirect />
        </LazyRoute>
      }
    />
    <Route
      path="/pr/:shortCode"
      element={
        <LazyRoute label="Loading…">
          <ProposalShortUrlRedirect />
        </LazyRoute>
      }
    />
    <Route
      path="/iv/:shortCode"
      element={
        <LazyRoute label="Loading…">
          <InvoiceShortUrlRedirect />
        </LazyRoute>
      }
    />
    <Route
      path="/invoice/:token"
      element={
        <LazyRoute label="Loading invoice…">
          <PublicInvoicePage />
        </LazyRoute>
      }
    />
    <Route
      path="/proposal/:token"
      element={
        <LazyRoute label="Loading proposal…">
          <PublicProposalPage />
        </LazyRoute>
      }
    />
    <Route
      path="/proposal/:token/accept"
      element={
        <LazyRoute label="Loading proposal…">
          <PublicProposalAcceptPageWithLocale />
        </LazyRoute>
      }
    />
    <Route
      path="/p/:shortCode"
      element={
        <LazyRoute label="Loading…">
          <PortalShortUrlRedirect />
        </LazyRoute>
      }
    />
    <Route
      path="/forms/:slug"
      element={
        <LazyRoute label="Loading form…">
          <FormPublicEntry />
        </LazyRoute>
      }
    />
  </Route>
);

/** Staff client preview — no CRM sidebar (CustomRoutes noLayout). */
export const renderLbsProposalClientPreviewRoute = () => (
  <Route
    path="/proposals/:id/client-preview"
    element={
      <LazyRoute label="Loading proposal preview…">
        <ProposalClientPreviewRoute />
      </LazyRoute>
    }
  />
);

export const renderLbsCustomRoutes = ({
  ProtectedRoute,
}: {
  ProtectedRoute: (props: ProtectedRouteProps) => JSX.Element;
}) => {
  return (
    <>
      {accountsHub ? (
        <Route path="/accounts" element={<AccountsHubList />} />
      ) : null}
      <Route
        path="/contacts/create"
        element={
          <Navigate
            to={
              accountsHub
                ? "/accounts?create=contact"
                : "/contacts?create=contact"
            }
            replace
          />
        }
      />
      <Route
        path="/contacts"
        element={
          accountsHub ? (
            <ListAliasToAccountsRedirect />
          ) : (
            <ProtectedRoute resource="contacts" action="list">
              <ClientsHubList />
            </ProtectedRoute>
          )
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
          accountsHub ? (
            <ListAliasToAccountsRedirect />
          ) : (
            <ProtectedRoute resource="companies" action="list">
              <ClientsHubList />
            </ProtectedRoute>
          )
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute resource="tasks" action="list">
            <LazyRoute label="Loading calendar…">
              <CalendarPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/meetings"
        element={
          <ProtectedRoute resource="tasks" action="list">
            <LazyRoute label="Loading meetings…">
              <MeetingsPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketing"
        element={
          <ProtectedRoute resource="marketing_campaigns" action="list">
            <LazyRoute label="Loading marketing…">
              <MarketingHubPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute resource="conversations" action="list">
            <LazyRoute label="Loading messages…">
              <MessagesPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mail"
        element={
          <ProtectedRoute resource="mail_threads" action="list">
            <LazyRoute label="Loading mail…">
              <MailPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads/create"
        element={
          accountsHub ? (
            <Navigate to="/accounts?view=board&create=lead" replace />
          ) : (
            <ProtectedRoute resource="contacts" action="create">
              <LeadCreatePage />
            </ProtectedRoute>
          )
        }
      />
      <Route
        path="/leads"
        element={
          accountsHub ? (
            <LeadsListToAccountsRedirect />
          ) : (
            <ProtectedRoute resource="contacts" action="list">
              <LeadsListPage />
            </ProtectedRoute>
          )
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
            <LazyRoute label="Loading web monitor…">
              <WebsiteMonitorQuickCheckPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/hostinger"
        element={
          <ProtectedRoute resource="hostinger_domains" action="list">
            <LazyRoute label="Loading Hostinger…">
              <HostingerHubPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/create"
        element={
          <Navigate
            to={
              accountsHub
                ? "/accounts?create=company"
                : "/clients?create=company"
            }
            replace
          />
        }
      />
      <Route
        path="/clients"
        element={
          accountsHub ? (
            <ClientsHubToAccountsRedirect />
          ) : (
            <ClientsHubList />
          )
        }
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
            <LazyRoute label="Loading ticket…">
              <TicketCreate />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals"
        element={
          <ProtectedRoute resource="proposals" action="list">
            <LazyRoute label="Loading proposals…">
              <ProposalsList />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/create"
        element={
          <ProtectedRoute resource="proposals" action="create">
            <LazyRoute label="Loading proposal…">
              <ProposalCreate />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/show"
        element={
          <ProtectedRoute resource="proposals" action="show">
            <LazyRoute label="Loading proposal…">
              <ProposalViewPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/edit"
        element={
          <ProtectedRoute resource="proposals" action="edit">
            <LazyRoute label="Loading proposal…">
              <ProposalEdit />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:id/preview"
        element={
          <ProtectedRoute resource="proposals" action="edit">
            <LazyRoute label="Loading proposal preview…">
              <ProposalPreviewPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts"
        element={
          <ProtectedRoute resource="contracts" action="list">
            <LazyRoute label="Loading contracts…">
              <ContractsList />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute
            resource="proposal_payment_installments"
            action="list"
          >
            <LazyRoute label="Loading billing…">
              <ClientBillingPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/new"
        element={
          <ProtectedRoute resource="client_invoices" action="create">
            <LazyRoute label="Loading invoice…">
              <StandaloneInvoiceCreatePage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/:id/show"
        element={
          <ProtectedRoute resource="client_invoices" action="show">
            <LazyRoute label="Loading invoice…">
              <InvoiceWorkspaceRedirect />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/invoices/:id/edit"
        element={
          <ProtectedRoute resource="client_invoices" action="edit">
            <LazyRoute label="Loading invoice…">
              <InvoiceWorkspaceRedirect />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts/:id/show"
        element={
          <ProtectedRoute resource="contracts" action="show">
            <LazyRoute label="Loading contract…">
              <ContractShow />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2"
        element={
          <ProtectedRoute resource="forms" action="list">
            <LazyRoute label="Loading forms…">
              <FormsListPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/new"
        element={
          <ProtectedRoute resource="forms" action="create">
            <LazyRoute label="Loading form builder…">
              <FormBuilderPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/:id/edit"
        element={
          <ProtectedRoute resource="forms" action="edit">
            <LazyRoute label="Loading form builder…">
              <FormBuilderPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/submissions/:id"
        element={
          <ProtectedRoute resource="forms" action="list">
            <LazyRoute label="Loading submission…">
              <SubmissionDetailPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/submissions"
        element={
          <ProtectedRoute resource="forms" action="list">
            <LazyRoute label="Loading submissions…">
              <SubmissionsListPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms-v2/:id/analytics"
        element={
          <ProtectedRoute resource="forms" action="list">
            <LazyRoute label="Loading analytics…">
              <FormAnalyticsPage />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/web-forms" element={<Navigate to="/forms-v2" replace />} />
      <Route
        path="/web-forms/*"
        element={<Navigate to="/forms-v2" replace />}
      />
      <Route
        path="/tickets"
        element={
          <ProtectedRoute resource="tickets" action="list">
            <LazyRoute label="Loading tickets…">
              <TicketsOverview />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/:id/show"
        element={
          <ProtectedRoute resource="tickets" action="show">
            <LazyRoute label="Loading ticket…">
              <TicketShow />
            </LazyRoute>
          </ProtectedRoute>
        }
      />
    </>
  );
};

/** @deprecated Use renderLbsCustomRoutes() inline inside <CustomRoutes>, not as JSX. */
export const LbsCustomRoutes = renderLbsCustomRoutes;
