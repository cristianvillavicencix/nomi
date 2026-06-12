import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type FormQRCodeProps = {
  formUrl: string;
  slug?: string;
};

export const FormQRCode = ({ formUrl, slug = "form" }: FormQRCodeProps) => {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!formUrl) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(formUrl, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    }).then(setQrDataUrl);
  }, [formUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `form-qr-${slug}.png`;
    link.click();
  };

  if (!formUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a public link to create a QR code.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="Form QR code"
          className="mx-auto max-w-full rounded-md border bg-white p-2"
        />
      ) : (
        <p className="text-sm text-muted-foreground">Generating QR code…</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!qrDataUrl}
        onClick={handleDownload}
      >
        <Download className="size-4" />
        Download PNG
      </Button>
    </div>
  );
};
