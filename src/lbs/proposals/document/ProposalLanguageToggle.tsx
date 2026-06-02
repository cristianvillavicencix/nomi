import { Button } from "@/components/ui/button";
import { getProposalDocumentCopy } from "@/lbs/proposals/document/proposalDocumentI18n";
import { useProposalLocale } from "@/lbs/proposals/document/ProposalLocaleContext";

export const ProposalLanguageToggle = () => {
  const { locale, setLocale } = useProposalLocale();
  const copy = getProposalDocumentCopy(locale);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "es" : "en")}
    >
      {copy.languageToggle}
    </Button>
  );
};
