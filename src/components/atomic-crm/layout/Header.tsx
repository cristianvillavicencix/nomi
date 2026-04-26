import { Link, matchPath, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { CRMUserMenuItems } from "./UserMenuItems";

const TIME_AND_PAY_PATHS = new Set([
  "/time_entries",
  "/payroll_runs",
  "/employee_loans",
]);

const TIME_AND_PAY_NAV = [
  { label: "Hours", subtitle: "Log and approve time", to: "/time_entries" },
  {
    label: "Payroll",
    subtitle: "Runs, approved hours, and payments",
    to: "/payroll_runs",
  },
  { label: "Loans", subtitle: "Advances and balances", to: "/employee_loans" },
] as const;

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else if (matchPath("/people/*", location.pathname)) {
    currentPath = "/people";
  } else if (matchPath("/time_entries/*", location.pathname)) {
    currentPath = "/time_entries";
  } else if (matchPath("/payments/*", location.pathname)) {
    currentPath = "/payroll_runs";
  } else if (matchPath("/payroll_runs/*", location.pathname)) {
    currentPath = "/payroll_runs";
  } else if (matchPath("/employee_loans/*", location.pathname)) {
    currentPath = "/employee_loans";
  } else if (matchPath("/reports/*", location.pathname)) {
    currentPath = "/reports";
  } else {
    currentPath = false;
  }

  const timeAndPaySection =
    typeof currentPath === "string" && TIME_AND_PAY_PATHS.has(currentPath)
      ? currentPath
      : null;

  return (
    <header className="bg-secondary">
      <div className="px-4">
        <div className="flex justify-between items-center flex-1">
          <Link
            to="/"
            className="flex items-center gap-2 text-secondary-foreground no-underline"
          >
            <img
              className="[.light_&]:hidden h-6"
              src={darkModeLogo}
              alt={title}
            />
            <img
              className="[.dark_&]:hidden h-6"
              src={lightModeLogo}
              alt={title}
            />
            <h1 className="text-xl font-semibold">{title}</h1>
          </Link>
          <div>
            <nav className="flex">
              <NavigationTab
                label="Dashboard"
                to="/"
                isActive={currentPath === "/"}
              />
              <NavigationTab
                label="Contacts"
                to="/contacts"
                isActive={currentPath === "/contacts"}
              />
              <NavigationTab
                label="Companies"
                to="/companies"
                isActive={currentPath === "/companies"}
              />
              <NavigationTab
                label="People"
                to="/people"
                isActive={currentPath === "/people"}
              />
              <NavigationTab
                label="Projects"
                to="/deals"
                isActive={currentPath === "/deals"}
              />
              <NavigationDropdown
                label="Time & pay"
                isActive={timeAndPaySection != null}
                selectedTo={timeAndPaySection}
                items={[...TIME_AND_PAY_NAV]}
              />
              <NavigationTab
                label="Reports"
                to="/reports"
                isActive={currentPath === "/reports"}
              />
            </nav>
          </div>
          <div className="flex items-center">
            <ThemeModeToggle />
            <RefreshButton />
            <UserMenu>
              <CRMUserMenuItems />
            </UserMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
  </Link>
);

const NavigationDropdown = ({
  label,
  isActive,
  selectedTo,
  items,
}: {
  label: string;
  isActive: boolean;
  selectedTo: string | null;
  items: ReadonlyArray<{ label: string; subtitle: string; to: string }>;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      className={`inline-flex items-center gap-1 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
        isActive
          ? "text-secondary-foreground border-secondary-foreground"
          : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
      }`}
    >
      {label}
      <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      {items.map((item) => {
        const isSelected = selectedTo === item.to;
        return (
          <DropdownMenuItem key={item.to} asChild>
            <Link
              to={item.to}
              className={`flex cursor-pointer flex-col gap-0.5 py-2.5 ${
                isSelected ? "bg-accent" : ""
              }`}
            >
              <span className={isSelected ? "font-semibold" : "font-medium"}>
                {item.label}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {item.subtitle}
              </span>
            </Link>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
export default Header;
