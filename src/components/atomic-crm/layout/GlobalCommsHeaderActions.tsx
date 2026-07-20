import { GlobalMessagesButton } from "@/modules/messages/GlobalMessagesButton";
import { GlobalDialButton } from "@/modules/voice/GlobalDialButton";

/** Global header quick-comms: message + dial popovers. */
export const GlobalCommsHeaderActions = () => (
  <>
    <GlobalMessagesButton />
    <GlobalDialButton />
  </>
);
