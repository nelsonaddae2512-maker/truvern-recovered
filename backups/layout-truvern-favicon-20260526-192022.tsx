import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import RootChrome from "@/components/layout/root-chrome.client";
import "./globals.css";
import AppShellNav from "@/components/layout/app-shell-nav.client";

export const metadata: Metadata = {
  title: "Truvern",
  description: "Vendor governance operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-[#020617] text-white antialiased">
          <RootChrome>{children}</RootChrome>
        </body>
      </html>
    </ClerkProvider>
  );
}



