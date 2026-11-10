"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? "/chat" : "/login");
  }, [router]);
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
