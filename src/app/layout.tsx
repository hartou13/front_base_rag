import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Interface voice: a plain, sturdy grotesk.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

// Reading voice: answers drawn from documents are set like text, in a serif with optical sizes.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Base RAG",
  description: "Ask questions of your own documents and check every answer against its sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${newsreader.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-full flex-col">
        {children}
        <Toaster theme="light" richColors position="top-center" />
      </body>
    </html>
  );
}
