export type PeopleQuickNavType = "employee" | "salesperson" | "subcontractor";

export type PeopleQuickNavItem = {
  id: string;
  type: PeopleQuickNavType;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  businessName?: string;
  displayName: string;
  specialty?: string;
  email?: string;
  phone?: string;
  status: "active" | "inactive";
};

