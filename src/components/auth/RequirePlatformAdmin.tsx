import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (loading) return;

      if (!user) {
        navigate("/auth/admin", { replace: true, state: { from: location.pathname } });
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "platform_admin")
        .limit(1);

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        toast({
          title: "Access denied",
          description: "Platform admin login is required to access this area.",
          variant: "destructive",
        });

        // Ensure we don't keep a non-admin session around.
        await supabase.auth.signOut();
        navigate("/auth/admin", { replace: true });
        return;
      }

      setChecking(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate, location.pathname, toast]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
