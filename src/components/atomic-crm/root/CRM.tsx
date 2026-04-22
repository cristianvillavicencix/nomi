import {
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
  type AuthProvider,
  useCanAccess,
} from "ra-core";
import { useEffect, useMemo } from "react";
import { Route } from "react-router";
import { Navigate } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Admin } from "@/components/admin/admin";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";

import companies from "../companies";
import contacts from "../contacts";
import { Dashboard } from "../dashboard/Dashboard";
import { MobileDashboard } from "../dashboard/MobileDashboard";
import deals from "../deals";
import { DesktopLayout } from "../layout/DesktopLayout";
import { MobileLayout } from "../layout/MobileLayout";
import { SignupPage } from "../login/SignupPage";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import { ImportPage } from "../misc/ImportPage";
import {
  authProvider as defaultAuthProvider,
  dataProvider as defaultDataProvider,
} from "../providers/supabase";
import sales from "../sales";
import people from "@/people";
import timeEntries from "@/timeEntries";
import payments from "@/payments";
import payrollRuns from "@/payrollRuns";
import loans from "@/loans";
import { ProfilePage } from "../settings/ProfilePage";
import { SettingsPage } from "../settings/SettingsPage";
import {
  ReportsPage,
} from "@/reports";
import {
  CONFIGURATION_STORE_KEY,
  type ConfigurationContextValue,
} from "./ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import {
  defaultCompanySectors,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelines,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";
import { i18nProvider } from "./i18nProvider";
import { StartPage } from "../login/StartPage.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { MobileTasksList } from "../tasks/MobileTasksList.tsx";
import { ContactListMobile } from "../contacts/ContactList.tsx";
import { ContactShow } from "../contacts/ContactShow.tsx";
import { CompanyShow } from "../companies/CompanyShow.tsx";
import { NoteShowPage } from "../notes/NoteShowPage.tsx";
import { PeopleQuickViewPage } from "@/people/PeopleQuickViewPage";
import { ContactQuickViewPage } from "../contacts/ContactQuickViewPage";
import { CompanyQuickViewPage } from "../companies/CompanyQuickViewPage";
import { Skeleton } from "@/components/ui/skeleton";

const defaultStore = localStorageStore(undefined, "CRM");

export type CRMProps = {
  dataProvider?: CrmDataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
  store?: CoreAdminProps["store"];
} & Partial<ConfigurationContextValue>;

/**
 * CRM Component
 *
 * This component sets up and renders the main CRM application using `ra-core`. It provides
 * default configurations and themes but allows for customization through props. The component
 * seeds the store with any custom prop values for backwards compatibility.
 *
 * @param {LabeledValue[]} companySectors - The list of company sectors used in the application.
 * @param {RaThemeOptions} darkTheme - The theme to use when the application is in dark mode.
 * @param {LabeledValue[]} dealCategories - The categories of deals used in the application.
 * @param {string[]} dealPipelineStatuses - The statuses of deals in the pipeline used in the application.
 * @param {DealStage[]} dealStages - The stages of deals used in the application.
 * @param {RaThemeOptions} lightTheme - The theme to use when the application is in light mode.
 * @param {string} logo - The logo used in the CRM application.
 * @param {NoteStatus[]} noteStatuses - The statuses of notes used in the application.
 * @param {LabeledValue[]} taskTypes - The types of tasks used in the application.
 * @param {string} title - The title of the CRM application.
 *
 * @returns {JSX.Element} The rendered CRM application.
 *
 * @example
 * // Basic usage of the CRM component
 * import { CRM } from '@/components/atomic-crm/dashboard/CRM';
 *
 * const App = () => (
 *     <CRM
 *         logo="/path/to/logo.png"
 *         title="My Custom CRM"
 *         lightTheme={{
 *             ...defaultTheme,
 *             palette: {
 *                 primary: { main: '#0000ff' },
 *             },
 *         }}
 *     />
 * );
 *
 * export default App;
 */
export const CRM = ({
  companySectors = defaultCompanySectors,
  dealCategories = defaultDealCategories,
  dealPipelines = defaultDealPipelines,
  dealPipelineStatuses = defaultDealPipelineStatuses,
  dealStages = defaultDealStages,
  darkModeLogo = defaultDarkModeLogo,
  lightModeLogo = defaultLightModeLogo,
  noteStatuses = defaultNoteStatuses,
  taskTypes = defaultTaskTypes,
  title = defaultTitle,
  dataProvider = defaultDataProvider,
  authProvider = defaultAuthProvider,
  store = defaultStore,
  googleWorkplaceDomain = import.meta.env.VITE_GOOGLE_WORKPLACE_DOMAIN,
  disableEmailPasswordAuthentication = import.meta.env
    .VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION === "true",
  disableTelemetry,
  ...rest
}: CRMProps) => {
  useEffect(() => {
    if (
      disableTelemetry ||
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      typeof window.location === "undefined" ||
      typeof Image === "undefined"
    ) {
      return;
    }
    const img = new Image();
    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;
  }, [disableTelemetry]);

  // Seed the store with CRM prop values if not already stored
  // (backwards compatibility for prop-based config)
  if (!store.getItem(CONFIGURATION_STORE_KEY)) {
    store.setItem(CONFIGURATION_STORE_KEY, {
      companySectors,
      dealCategories,
      dealPipelines,
      dealPipelineStatuses,
      dealStages,
      noteStatuses,
      taskTypes,
      title,
      darkModeLogo,
      lightModeLogo,
      googleWorkplaceDomain,
      disableEmailPasswordAuthentication,
    } satisfies ConfigurationContextValue);
  }

  const isMobile = useIsMobile();

  // on login, pre-fetch the configuration to avoid a flickering
  // when accessing the app for the first time
  const wrappedAuthProvider = useMemo<AuthProvider>(
    () => ({
      ...authProvider,
      login: async (params: any) => {
        const result = await authProvider.login(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      handleCallback: async (params: any) => {
        if (!authProvider.handleCallback) {
          throw new Error(
            "handleCallback is not implemented in the authProvider",
          );
        }
        const result = await authProvider.handleCallback(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      logout: async (params: any) => {
        try {
          store.removeItem(CONFIGURATION_STORE_KEY);
        } catch {
          // Ignore
        }
        return authProvider.logout(params);
      },
    }),
    [authProvider, dataProvider, store],
  );

  const ResponsiveAdmin = isMobile ? MobileAdmin : DesktopAdmin;

  return (
    <ResponsiveAdmin
      dataProvider={dataProvider}
      authProvider={wrappedAuthProvider}
      i18nProvider={i18nProvider}
      store={store}
      loginPage={StartPage}
      requireAuth
      disableTelemetry
      {...rest}
    />
  );
};

const DesktopAdmin = (props: CoreAdminProps) => {
  return (
    <Admin layout={DesktopLayout} dashboard={Dashboard} {...props}>
      <CustomRoutes noLayout>
        <Route path={SignupPage.path} element={<SignupPage />} />
        <Route
          path={ConfirmationRequired.path}
          element={<ConfirmationRequired />}
        />
        <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
        <Route
          path={ForgotPasswordPage.path}
          element={<ForgotPasswordPage />}
        />
        <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
      </CustomRoutes>

      <CustomRoutes>
        <Route path={ProfilePage.path} element={<ProfilePage />} />
        <Route
          path={SettingsPage.path}
          element={
            <ProtectedRoute resource="configuration" action="edit">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path={ImportPage.path} element={<ImportPage />} />
        <Route
          path="/contacts/:id/show"
          element={
            <ProtectedRoute resource="contacts" action="list">
              <ContactQuickViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id/show"
          element={
            <ProtectedRoute resource="companies" action="list">
              <CompanyQuickViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id/show/:tab"
          element={
            <ProtectedRoute resource="companies" action="list">
              <CompanyQuickViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/employees"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="employee" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/employees/:id"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="employee" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/employees/:id/:tab"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="employee" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/salespeople"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="salesperson" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/salespeople/:id"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="salesperson" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/salespeople/:id/:tab"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="salesperson" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/subcontractors"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="subcontractor" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/subcontractors/:id"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="subcontractor" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/people/subcontractors/:id/:tab"
          element={
            <ProtectedRoute resource="people" action="list">
              <PeopleQuickViewPage type="subcontractor" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute resource="reports" action="list">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/project-profitability"
          element={
            <ProtectedRoute resource="reports" action="list">
              <ReportsPage initialTab="project-profitability" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/payroll-summary"
          element={
            <ProtectedRoute resource="reports" action="list">
              <ReportsPage initialTab="payroll-summary" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/labor-cost-by-person"
          element={
            <ProtectedRoute resource="reports" action="list">
              <ReportsPage initialTab="labor-cost-by-person" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/sales-commissions"
          element={
            <ProtectedRoute resource="reports" action="list">
              <ReportsPage initialTab="sales-commissions" />
            </ProtectedRoute>
          }
        />
        <Route path="/projects" element={<Navigate to="/deals" replace />} />
      </CustomRoutes>
      <Resource name="deals" {...deals} />
      <Resource name="people" {...people} />
      <Resource name="time_entries" {...timeEntries} />
      <Resource name="payments" {...payments} />
      <Resource name="payment_lines" />
      <Resource name="payroll_runs" {...payrollRuns} />
      <Resource name="payroll_run_lines" />
      <Resource name="employee_loans" {...loans} />
      <Resource name="employee_loan_deductions" />
      <Resource name="employee_pto_adjustments" />
      <Resource name="contacts" {...contacts} />
      <Resource name="companies" {...companies} />
      <Resource name="contact_notes" />
      <Resource name="deal_notes" />
      <Resource name="deal_subcontractor_entries" />
      <Resource name="deal_expenses" />
      <Resource name="deal_change_orders" />
      <Resource name="deal_commissions" />
      <Resource name="deal_client_payments" />
      <Resource name="tasks" />
      <Resource name="sales" {...sales} />
      <Resource name="tags" />
    </Admin>
  );
};

const ProtectedRoute = ({
  resource,
  action,
  children,
}: {
  resource: string;
  action: string;
  children: JSX.Element;
}) => {
  const { canAccess, isPending } = useCanAccess({ resource, action });

  if (isPending) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const MobileAdmin = (props: CoreAdminProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
  const asyncStoragePersister = createAsyncStoragePersister({
    storage: localStorage,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Admin
        queryClient={queryClient}
        layout={MobileLayout}
        dashboard={MobileDashboard}
        {...props}
      >
        <CustomRoutes noLayout>
          <Route path={SignupPage.path} element={<SignupPage />} />
          <Route
            path={ConfirmationRequired.path}
            element={<ConfirmationRequired />}
          />
          <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
          <Route
            path={ForgotPasswordPage.path}
            element={<ForgotPasswordPage />}
          />
          <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
        </CustomRoutes>
        <Resource
          name="contacts"
          list={ContactListMobile}
          show={ContactShow}
          recordRepresentation={contacts.recordRepresentation}
        >
          <Route path=":id/notes/:noteId" element={<NoteShowPage />} />
        </Resource>
        <Resource name="companies" show={CompanyShow} />
        <Resource name="tasks" list={MobileTasksList} />
      </Admin>
    </PersistQueryClientProvider>
  );
};
