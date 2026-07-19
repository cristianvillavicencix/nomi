import * as React from "react";
import { Notification } from "@/components/admin/notification";
import { BrandWordmark } from "@/components/atomic-crm/layout/BrandWordmark";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { PRODUCT_FULL_NAME } from "@/lib/branding";

export const Layout = ({ children }: React.PropsWithChildren) => {
  const { darkModeLogo, title } = useConfigurationContext();

  return (
    <div className="min-h-screen flex">
      <div className="container relative grid flex-col items-center justify-center sm:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center gap-2 text-lg font-medium">
            <img
              className="mr-1 h-6 w-6 rounded-sm object-cover"
              src={darkModeLogo}
              alt={PRODUCT_FULL_NAME}
            />
            <BrandWordmark
              title={title}
              titleClassName="text-lg text-white"
              subtitleClassName="text-white/70"
            />
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            {children}
          </div>
        </div>
      </div>
      <Notification />
    </div>
  );
};
