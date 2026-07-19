import { CreateButton } from "@/components/admin/create-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import useAppBarHeight from "../misc/useAppBarHeight";
import { ContactImportButton } from "./ContactImportButton";
import { ContactCreateSheet } from "./ContactCreateSheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const ContactEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const isMobile = useIsMobile();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <>
      <ContactCreateSheet open={createOpen} onOpenChange={setCreateOpen} />
      <div
        className="flex flex-col justify-center items-center gap-3"
        style={{
          height: `calc(100dvh - ${appbarHeight}px)`,
        }}
      >
        <img src="./img/empty.svg" alt="No contacts found" />
        <div className="flex flex-col gap-0 items-center">
          <h6 className="text-lg font-bold">No people found</h6>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Add a contact or lead from Accounts to get started.
          </p>
        </div>
        <div className="flex flex-row gap-2">
          {isMobile ? (
            <Button
              onClick={() => setCreateOpen(true)}
              variant="secondary"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Contact
            </Button>
          ) : (
            <>
              <CreateButton label="New Contact" />
              <ContactImportButton />
            </>
          )}
        </div>
      </div>
    </>
  );
};
