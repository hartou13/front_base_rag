import { cn } from "@/lib/utils";

/** Product name, set in the reading serif. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-reading text-[1.3125rem] font-medium leading-none tracking-[-0.01em] text-ink", className)}>
      Base RAG
    </span>
  );
}
