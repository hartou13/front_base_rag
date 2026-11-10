"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getToken, redirectToLogin } from "@/lib/auth";
import { useHydrated } from "@/lib/hooks";

/** Renders children only when a token is present; otherwise redirects to /login. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const hasToken = hydrated && !!getToken();

  useEffect(() => {
    if (hydrated && !hasToken) redirectToLogin();
  }, [hydrated, hasToken]);

  if (!hasToken) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  return <>{children}</>;
}
