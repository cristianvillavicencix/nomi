import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useDataProvider, useLogin, useNotify } from "ra-core";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { SignUpData } from "../types";
import { Notification } from "@/components/admin/notification";
import { ConfirmationRequired } from "./ConfirmationRequired";
import { SSOAuthButton } from "./SSOAuthButton";

export const SignupPage = () => {
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const {
    darkModeLogo: logo,
    title,
    googleWorkplaceDomain,
  } = useConfigurationContext();
  const navigate = useNavigate();
  const { isPending: isSignUpPending, mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SignUpData) => {
      return dataProvider.signUp(data);
    },
    onSuccess: (data) => {
      login({
        email: data.email,
        password: data.password,
        redirectTo: "/contacts",
      })
        .then(() => {
          notify("Account created");
          // FIXME: We should probably provide a hook for that in the ra-core package
          queryClient.invalidateQueries({
            queryKey: ["auth", "canAccess"],
          });
        })
        .catch((err) => {
          if (err.code === "email_not_confirmed") {
            // An email confirmation is required to continue.
            navigate(ConfirmationRequired.path);
          } else {
            notify("Failed to log in.", {
              type: "error",
            });
            navigate("/login");
          }
        });
    },
    onError: (error) => {
      notify(error.message, { type: "error" });
    },
  });

  const login = useLogin();
  const notify = useNotify();

  const {
    register,
    handleSubmit,
    formState: { isValid },
  } = useForm<SignUpData>({
    mode: "onChange",
    defaultValues: {
      company_name: "",
    },
  });

  const onSubmit: SubmitHandler<SignUpData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="h-screen p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1.5">
          <Link to="/login" aria-label="Volver al inicio de sesión">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src={logo}
            alt={title}
            width={24}
            className="shrink-0 filter brightness-0 invert"
          />
          <h1 className="truncate text-xl font-semibold">{title}</h1>
        </div>
      </div>
      <div className="h-full">
        <div className="mx-auto flex h-full max-w-sm flex-col justify-center gap-4">
          <h1 className="mb-1 text-2xl font-bold">Welcome to {title}</h1>
          <p className="mb-2 text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Inicia sesión
            </Link>
            .
          </p>
          <p className="text-base text-muted-foreground">
            Create your company workspace. You can invite your team later from
            Settings → Users.
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input
                {...register("company_name", { required: true, minLength: 2 })}
                id="company_name"
                type="text"
                required
                autoComplete="organization"
                placeholder="Your company or team name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                {...register("first_name", { required: true })}
                id="first_name"
                type="text"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                {...register("last_name", { required: true })}
                id="last_name"
                type="text"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                {...register("email", { required: true })}
                id="email"
                type="email"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                {...register("password", { required: true })}
                id="password"
                type="password"
                required
              />
            </div>
            <div className="mt-6 flex flex-col items-stretch gap-3">
              <Button
                type="submit"
                disabled={!isValid || isSignUpPending}
                className="w-full"
              >
                {isSignUpPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/login")}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground sm:w-auto"
                  asChild
                >
                  <Link to="/login">Iniciar sesión</Link>
                </Button>
              </div>
              {googleWorkplaceDomain ? (
                <SSOAuthButton
                  className="w-full"
                  domain={googleWorkplaceDomain}
                >
                  Sign in with Google Workplace
                </SSOAuthButton>
              ) : null}
            </div>
          </form>
        </div>
      </div>
      <Notification />
    </div>
  );
};

SignupPage.path = "/sign-up";
