import { useState } from "react";
import { useResetPassword } from "ra-supabase-core";
import { Form, required, useNotify, useRedirect, useTranslate } from "ra-core";
import { EmailInput } from "@/components/admin/email-input";
import { Layout } from "@/components/supabase/layout";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui/button";

interface FormData {
  email: string;
}

const getSetPasswordRedirectUrl = () => {
  const base = import.meta.env.BASE_URL || "/";
  const basePath = base.endsWith("/") ? base : `${base}/`;
  return new URL(`${basePath}set-password`, window.location.origin).toString();
};

export const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);

  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();
  const [, { mutateAsync: resetPassword }] = useResetPassword({
    onSuccess: () => {
      redirect("/login?passwordRecoveryEmailSent=1");
    },
    onError: () => undefined,
  });

  const submit = async (values: FormData) => {
    try {
      setLoading(true);
      await resetPassword({
        email: values.email,
        redirectTo: getSetPasswordRedirectUrl(),
      });
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      const status = err?.status;
      const message = err?.message ?? "";
      const rateLimited =
        status === 429 ||
        message.includes("429") ||
        /too many requests/i.test(message);

      notify(
        rateLimited
          ? "Too many reset emails were requested. Wait about an hour, then check spam for an earlier message before trying again."
          : typeof error === "string"
            ? error
            : message || "ra.auth.sign_in_error",
        {
          type: "warning",
          messageArgs: {
            _: rateLimited
              ? "Too many reset emails were requested. Wait about an hour, then check spam for an earlier message before trying again."
              : typeof error === "string"
                ? error
                : message || undefined,
          },
        },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate("ra-supabase.reset_password.forgot_password", {
            _: "Forgot password?",
          })}
        </h1>
        <p>
          {translate("ra-supabase.reset_password.forgot_password_details", {
            _: "Enter your email to receive a reset password link.",
          })}
        </p>
      </div>
      <Form<FormData>
        className="space-y-8"
        onSubmit={submit as SubmitHandler<FieldValues>}
      >
        <EmailInput
          source="email"
          label={translate("ra.auth.email", {
            _: "Email",
          })}
          autoComplete="email"
          validate={required()}
        />
        <Button type="submit" className="cursor-pointer" disabled={loading}>
          {translate("ra.action.reset_password", {
            _: "Reset password",
          })}
        </Button>
      </Form>
    </Layout>
  );
};

ForgotPasswordPage.path = "forgot-password";
