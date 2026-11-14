import type { Metadata } from "next";
import { IBM_Plex_Mono, Outfit } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AppThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PHP Security Checker",
    template: "%s · PHP Security Checker",
  },
  description:
    "Check an installed PHP version against known runtime vulnerabilities and the official support timeline.",
  verification: { google: "rE5wA0YQEuBOKMiP8jOhXePlFCnfh85Fya2Sy-1Gn3E" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${plex.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <AppThemeProvider>
          <TooltipProvider>
            <a
              href="#content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <SiteHeader />
            <div id="content" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </div>
            <SiteFooter />
          </TooltipProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
