import { Button } from "@/components/ui/button";
import { getProposalDocumentCopy } from "@/lbs/proposals/document/proposalDocumentI18n";
import { useProposalLocale } from "@/lbs/proposals/document/ProposalLocaleContext";

export const ProposalLanguageToggle = ({
  className,
}: {
  className?: string;
}) => {
  const { locale, setLocale } = useProposalLocale();
  const copy = getProposalDocumentCopy(locale);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => setLocale(locale === "en" ? "es" : "en")}
    >
      {copy.languageToggle}
    </Button>
  );
};
