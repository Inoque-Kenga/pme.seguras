import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { FeedbackToaster } from "@/components/feedback-toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyberPME | Gestão de Cibersegurança",
  description: "Plataforma de gestão de cibersegurança para PME.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-AO" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <Suspense fallback={null}>
          <FeedbackToaster />
        </Suspense>
      </body>
    </html>
  );
}
