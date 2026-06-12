import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

export const ShortUrlRedirect = () => {
  const { shortCode = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!shortCode) {
      setError(true);
      return;
    }

    const resolve = async () => {
      try {
        const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(
          /\/$/,
          "",
        );
        const response = await fetch(
          `${baseUrl}/functions/v1/resolve_short_code?code=${encodeURIComponent(shortCode)}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
            },
          },
        );
        if (!response.ok) {
          setError(true);
          return;
        }
        const payload = (await response.json()) as { token?: string };
        if (payload.token) {
          navigate(`/forms/${payload.token}`, { replace: true });
          return;
        }
        setError(true);
      } catch {
        setError(true);
      }
    };

    void resolve();
  }, [navigate, shortCode]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="text-xl font-semibold">Link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This short link is invalid or has expired.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">
      Loading form…
    </div>
  );
};
