import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import {
  defaultCompanySectors,
  primaryBusinessSectorUnsetToken,
} from "../root/defaultConfiguration";
import ImageEditorField from "../misc/ImageEditorField";
import { isTenantBrandingEditorVisible } from "./tenantBrandingFlags";

const SECTOR_CHOICES = [
  { id: primaryBusinessSectorUnsetToken, name: "Select a sector" },
  ...defaultCompanySectors.map((s) => ({ id: s.value, name: s.label })),
];

/** Same rules as company forms; allows empty. */
const optionalWebsite = (value: string) => {
  if (value == null || String(value).trim() === "") return undefined;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(String(value).trim())) {
    return "Enter a valid website URL (e.g. https://yoursite.com)";
  }
  return undefined;
};

/**
 * General: optional branding, business details + one sector. Supabase `organizations.name` is not edited here.
 */
export const SettingsGeneralTab = () => {
  return (
    <div className="space-y-12 max-w-6xl">
      {isTenantBrandingEditorVisible() ? (
        <section className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Branding</h2>
          <div className="space-y-4">
            <TextInput source="title" label="App title" />
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Light logo</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Dark logo</p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a1a"
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-base font-semibold tracking-tight">Your business</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput source="companyLegalName" label="Business name" />
          <TextInput source="companyPhone" label="Phone" />
          <TextInput source="companyEmail" label="Email" type="email" />
          <TextInput
            source="companyWebsite"
            label="Website"
            type="url"
            placeholder="https://example.com"
            validate={optionalWebsite}
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <TextInput
              source="companyAddressLine1"
              label="Address"
              className="w-full"
              multiline
              rows={2}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 max-w-md">
            <SelectInput
              source="primaryBusinessSector"
              label="Your sector (industry)"
              choices={SECTOR_CHOICES}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
