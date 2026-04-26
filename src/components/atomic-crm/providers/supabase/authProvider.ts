import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { isPlatformConsolePath } from "@/platform/platformConsolePaths";
import { canAccess } from "../commons/canAccess";
import { supabase } from "./supabase";

const baseAuthProvider = supabaseAuthProvider(supabase, {
  getIdentity: async () => {
    const sale = await getSale(false);

    if (sale == null) {
      throw new Error();
    }

    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
      administrator: sale.administrator === true,
      role: sale.administrator ? 'admin' : sale.roles?.[0] ?? 'user',
      roles: sale.roles ?? (sale.administrator ? ['admin'] : []),
    };
  },
});

// To speed up checks, we cache the initialization state
// and the current sale in the local storage. They are cleared on logout.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_SALE_CACHE_KEY = "RaStore.auth.current_sale";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export async function getIsInitialized() {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cachedValue != null) {
    return cachedValue === "true";
  }

  const { data } = await supabase.from("init_state").select("is_initialized");
  const isInitialized = data?.at(0)?.is_initialized > 0;

  if (isInitialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }

  return isInitialized;
}

const fetchSale = async () => {
  const { data: dataSession, error: errorSession } =
    await supabase.auth.getSession();

  // Shouldn't happen after login but just in case
  if (dataSession?.session?.user == null || errorSession) {
    return undefined;
  }

  const { data: dataSale, error: errorSale } = await supabase
    .from("organization_members")
    .select("id, first_name, last_name, avatar, administrator, roles")
    .match({ user_id: dataSession?.session?.user.id })
    .single();

  // Shouldn't happen either as all users are sales but just in case
  if (dataSale == null || errorSale) {
    return undefined;
  }

  const storage = getLocalStorage();
  storage?.setItem(CURRENT_SALE_CACHE_KEY, JSON.stringify(dataSale));
  return dataSale;
};

const getSale = async (useCache = true) => {
  const storage = getLocalStorage();
  const cachedValue = useCache ? storage?.getItem(CURRENT_SALE_CACHE_KEY) : null;
  if (cachedValue != null) {
    return JSON.parse(cachedValue);
  }

  return fetchSale();
};

function clearCache() {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_SALE_CACHE_KEY);
}

/**
 * When the app is deployed with a Vite `base` (e.g. /profile/), pathname is
 * /profile/sign-up, not /sign-up — strict equality in checkAuth was skipping
 * the public page and users ended up in the app with an active session.
 */
function isPublicAuthRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const hash = window.location.hash;
  const segment =
    (s: "sign-up" | "set-password" | "forgot-password") =>
    path === `/${s}` || path.endsWith(`/${s}`) || hash.includes(`#/${s}`);
  return segment("set-password") || segment("forgot-password") || segment("sign-up");
}

/** `/sas/*` (consola Nomi) o path legado/typo; no exige ficha de `organization_members`. */
function isPlatformConsoleAuthRoute(): boolean {
  if (typeof window === "undefined") return false;
  return isPlatformConsolePath(window.location.pathname);
}

export const authProvider: AuthProvider = {
  ...baseAuthProvider,
  login: async (params) => {
    if (params.ssoDomain) {
      const { error } = await supabase.auth.signInWithSSO({
        domain: params.ssoDomain,
      });
      if (error) {
        throw error;
      }
      return;
    }
    return baseAuthProvider.login(params);
  },
  logout: async (params) => {
    clearCache();
    return baseAuthProvider.logout(params);
  },
  checkAuth: async (params) => {
    if (isPublicAuthRoute()) {
      return;
    }
    if (isPlatformConsoleAuthRoute()) {
      return;
    }

    const isInitialized = await getIsInitialized();

    if (!isInitialized) {
      await supabase.auth.signOut();
      throw {
        redirectTo: "/login",
        message: false,
      };
    }

    return baseAuthProvider.checkAuth(params);
  },
  canAccess: async (params) => {
    const isInitialized = await getIsInitialized();
    if (!isInitialized) return false;

    // Get the current user
    const sale = await getSale();
    if (sale == null) return false;

    return canAccess(
      {
        administrator: sale.administrator,
        role: sale.administrator ? "admin" : "user",
        roles: sale.roles ?? [],
      },
      params,
    );
  },
  getAuthorizationDetails(authorizationId: string) {
    return supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  },
  approveAuthorization(authorizationId: string) {
    return supabase.auth.oauth.approveAuthorization(authorizationId);
  },
  denyAuthorization(authorizationId: string) {
    return supabase.auth.oauth.denyAuthorization(authorizationId);
  },
};
