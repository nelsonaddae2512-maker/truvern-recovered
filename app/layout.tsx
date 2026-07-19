import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import RootChrome from "@/components/layout/root-chrome.client";
import "./globals.css";
import AppShellNav from "@/components/layout/app-shell-nav.client";

export const metadata: Metadata = {
  title: "Truvern",
  description: "Vendor governance operations platform",
  icons: {
    icon: [
      { url: "/truvern-mark.svg", type: "image/svg+xml" },
      { url: "/truvern-mark.png", type: "image/png" },
    ],
    shortcut: "/truvern-mark.svg",
    apple: "/truvern-mark.png",
  },
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




