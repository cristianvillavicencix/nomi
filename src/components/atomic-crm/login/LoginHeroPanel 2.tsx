import { BrandWordmark } from "@/components/atomic-crm/layout/BrandWordmark";
import {
  LOGIN_HERO_IMAGE_URL,
  PRODUCT_FULL_NAME,
  PRODUCT_ORG,
} from "@/lib/branding";

type LoginHeroPanelProps = {
  logoSrc: string;
  title: string;
};

export function LoginHeroPanel({ logoSrc, title }: LoginHeroPanelProps) {
  return (
    <div className="relative hidden h-full min-h-screen flex-col overflow-hidden text-white lg:flex">
      <img
        src={LOGIN_HERO_IMAGE_URL}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-zinc-950/92 via-zinc-900/78 to-zinc-950/88"
        aria-hidden
      />
      <div className="relative z-20 flex min-h-0 flex-1 flex-col p-10">
        <div className="flex shrink-0 items-center gap-2 text-lg font-medium">
          <img
            className="mr-1 h-6 w-6 rounded-sm object-cover"
            src={logoSrc}
            alt={PRODUCT_FULL_NAME}
          />
          <BrandWordmark
            title={title}
            titleClassName="text-lg text-white"
            subtitleClassName="text-white/70"
          />
        </div>

        <div className="flex flex-1 items-center py-8">
          <div className="max-w-md space-y-3">
            <p className="text-2xl font-semibold leading-snug tracking-tight text-white">
              Your business workspace, in one place.
            </p>
            <p className="text-sm leading-relaxed text-white/75">
              Contacts, mail, projects, deals, and billing — for {PRODUCT_ORG}{" "}
              teams and the clients you serve.
            </p>
          </div>
        </div>

        <p className="shrink-0 max-w-md text-xs leading-relaxed text-white/50">
          {PRODUCT_FULL_NAME} — built for contractors, agencies, and service
          businesses.
        </p>
      </div>
    </div>
  );
}
