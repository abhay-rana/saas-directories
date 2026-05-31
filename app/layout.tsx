import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SaaS Directories — 280+ Places to Submit Your Product for Free Backlinks",
  description:
    "A curated, community-maintained list of 280+ SaaS directories and 66 launch sites. Filter by DA, link type, and cost. Track your submission progress — no signup required.",
  keywords: [
    "saas directories",
    "submit saas product",
    "free backlinks for startups",
    "product hunt alternatives",
    "launch sites for startups",
    "saas marketing directories",
    "indie hacker directories",
    "dofollow directories",
  ],
  authors: [{ name: "Abhay Rana", url: "https://abhayrana.com" }],
  openGraph: {
    title: "SaaS Directories — 280+ Places to Submit Your Product",
    description:
      "Filter by DA, link type, and cost. Track your own submission progress in-browser. Community-maintained and open source.",
    url: "https://marketing.abhayrana.com",
    siteName: "SaaS Directories by Abhay Rana",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaaS Directories — 280+ Places to Submit Your Product",
    description:
      "Filter by DA, link type, and cost. Track your own submission progress in-browser. Community-maintained and open source.",
    creator: "@r4fken",
  },
  alternates: {
    canonical: "https://marketing.abhayrana.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
