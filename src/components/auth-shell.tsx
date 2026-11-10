import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export function AuthShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: { text: string; href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="grid flex-1 bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Wordmark />
        <div className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[22rem]">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>
            <div className="mt-8 [&_input]:h-10 [&_input]:bg-white [&_select]:h-10 [&_select]:bg-white [&_button[type=submit]]:h-10">
              {children}
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              {footer.text}{" "}
              <Link
                href={footer.href}
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
              >
                {footer.label}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <aside aria-hidden className="hidden flex-col justify-center border-l border-rule bg-shelf px-16 lg:flex">
        <div className="max-w-[30rem]">
          <p className="font-reading text-[2.5rem] leading-[1.12] tracking-[-0.01em] text-ink">
            Ask your documents. See exactly where each answer comes from.
          </p>

          <div className="mt-12 rounded-[10px] border border-rule bg-paper p-6">
            <p className="text-[0.9375rem] font-semibold text-ink">How long is the warranty on the device?</p>
            <ol className="mt-3 flex gap-4 text-[0.8125rem] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="source-chip inline-flex size-[1.35rem] items-center justify-center rounded-[3px] text-[0.75rem] font-semibold text-ink">
                  1
                </span>
                user-guide.pdf
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="source-chip inline-flex size-[1.35rem] items-center justify-center rounded-[3px] text-[0.75rem] font-semibold text-ink"
                  style={{ "--i": 1 } as React.CSSProperties}
                >
                  2
                </span>
                terms.md
              </li>
            </ol>
            <p className="mt-4 font-reading text-[1.0625rem] leading-relaxed text-ink">
              The device is covered for two years from the date of purchase.
            </p>
            <blockquote className="mt-4 border-l-2 border-highlighter-strong pl-4 font-reading text-[0.9375rem] leading-relaxed text-ink">
              <span className="excerpt-mark">The warranty period is two (2) years from the original date of purchase.</span>
            </blockquote>
          </div>
        </div>
      </aside>
    </main>
  );
}
