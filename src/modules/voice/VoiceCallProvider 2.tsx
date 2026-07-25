import { lazy, Suspense, type ReactNode } from "react";
import { useGetIdentity } from "ra-core";
import { memberHasVoiceCallCapability } from "@/lib/permissions/voiceCallCapability";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";

const VoiceCallProviderInner = lazy(() =>
  import("@/modules/voice/VoiceCallProviderInner").then((module) => ({
    default: module.VoiceCallProviderInner,
  })),
);

export const VoiceCallProvider = ({ children }: { children: ReactNode }) => {
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const canUseVoice = memberHasVoiceCallCapability(
    identity as AccessIdentity | undefined,
  );

  const shouldLoadVoice =
    voiceEnabled && canUseVoice && Boolean(identity?.id);

  if (!shouldLoadVoice && !isPending) {
    return <>{children}</>;
  }

  if (!shouldLoadVoice && isPending) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={children}>
      <VoiceCallProviderInner>{children}</VoiceCallProviderInner>
    </Suspense>
  );
};
