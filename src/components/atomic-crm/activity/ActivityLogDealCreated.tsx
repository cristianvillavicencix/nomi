import type { RaRecord } from "ra-core";
import { Link } from "react-router";

import { ReferenceField } from "@/components/admin/reference-field";
import { RelativeDate } from "../misc/RelativeDate";
import { OrganizationMemberName } from "../organizationMembers/OrganizationMemberName";
import type { ActivityDealCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { useIsMobile } from "@/hooks/use-mobile";

type ActivityLogDealCreatedProps = {
  activity: RaRecord & ActivityDealCreated;
};

export function ActivityLogDealCreated({
  activity,
}: ActivityLogDealCreatedProps) {
  const context = useActivityLogContext();
  const isMobile = useIsMobile();
  const { deal } = activity;
  return (
    <div className="p-0">
      <div className="flex flex-row gap-2 items-start w-full">
        <div className="w-[20px] h-[20px] bg-gray-300 rounded-full shrink-0" />
        <span className="text-muted-foreground text-sm flex-grow">
          <ReferenceField source="organization_member_id" reference="organization_members" record={activity}>
            <OrganizationMemberName />
          </ReferenceField>{" "}
          added project{" "}
          {isMobile ? (
            deal.name
          ) : (
            <Link to={`/deals/${deal.id}/show`}>{deal.name}</Link>
          )}{" "}
          {context !== "company" && (
            <>
              to{" "}
              <ReferenceField
                source="company_id"
                reference="companies"
                record={activity}
                link="show"
              />{" "}
              <RelativeDate date={activity.date} />
            </>
          )}
        </span>
        {context === "company" && (
          <span className="text-muted-foreground text-sm">
            <RelativeDate date={activity.date} />
          </span>
        )}
      </div>
    </div>
  );
}
