import { Notification } from "@/components/admin/notification";
import { BrandWordmark } from "../layout/BrandWordmark";
import { PRODUCT_FULL_NAME } from "@/lib/branding";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ConfirmationRequired = () => {
  const { darkModeLogo: logo, title } = useConfigurationContext();

  return (
    <div className="h-screen p-8">
      <div className="flex items-center gap-4">
        <img
          src={logo}
          alt={PRODUCT_FULL_NAME}
          width={24}
          className="h-6 w-6 rounded-sm object-cover filter brightness-0 invert"
        />
        <BrandWordmark title={title} titleClassName="text-xl" />
      </div>
      <div className="h-full text-center">
        <div className="max-w-sm mx-auto h-full flex flex-col justify-center gap-4">
          <h1 className="text-2xl font-bold mb-4">
            Welcome to {PRODUCT_FULL_NAME}
          </h1>
          <p className="text-base mb-4">
            Please follow the link we just sent you by email to confirm your
            account.
          </p>
        </div>
      </div>
      <Notification />
    </div>
  );
};

ConfirmationRequired.path = "/sign-up/confirm";
