import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

/** `true` si el usuario de Supabase figura en `platform_operators`. */
export const isUserPlatformOperator = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from("platform_operators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

/**
 * Resolves if the current auth user is in `platform_operators` (SaaS / global directory).
 * Invalidates on auth changes so a fresh login sees updated permissions.
 */
export const usePlatformOperator = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "platform_operator"] });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: ["auth", "platform_operator"],
    queryFn: async () => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        return { isPlatformOperator: false, authUserId: null as string | null };
      }
      const uid = userData.user?.id ?? null;
      if (!uid) {
        return { isPlatformOperator: false, authUserId: null as string | null };
      }
      const { data, error } = await supabase
        .from("platform_operators")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return { isPlatformOperator: Boolean(data), authUserId: uid };
    },
    staleTime: 0,
  });
};
