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
  title: "A2A Inspector — validate & test Agent2Agent agents",
  description:
    "A Postman for Google's Agent2Agent (A2A) protocol. Validate an Agent Card against the A2A spec, fire live tasks, and watch the task lifecycle stream.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "A2A Inspector",
    description:
      "Validate Agent Cards and test live A2A agents — a Postman for the Agent2Agent protocol.",
    type: "website",
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Set the theme before paint to avoid a flash; falls back to the
            OS preference, then dark. Kept inline + minimal on purpose. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
