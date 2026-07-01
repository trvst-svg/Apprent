import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://apprent.dev"),
  title: {
    default: "Apprent | AI-Powered Coding & Interactive Apprenticeship Platform",
    template: "%s | Apprent"
  },
  description: "Learn programming languages, solve sandbox coding challenges, participate in live expert streams, and get AI-assisted real-time code reviews.",
  keywords: [
    "AI code review", 
    "interactive coding sandbox", 
    "learn programming online", 
    "live coding stream", 
    "pair programming tutor", 
    "developer learning paths",
    "Go channels tutorial",
    "prevent goroutine leaks"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Apprent | Interactive Coding & Mentorship Platform",
    description: "Apprentice under top-tier tech experts as they write real-world production code. Sandbox challenges, audio overlays, and privacy-protected streams.",
    url: "/",
    siteName: "Apprent",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Apprent Learning Platform"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Apprent | Learn Coding Live with AI Support",
    description: "AI code reviews, live streams, and interactive developer roadmaps.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 selection:bg-violet-500/30 selection:text-violet-200">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
