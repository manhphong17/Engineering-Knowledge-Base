import type { Metadata } from "next";
import Script from "next/script";

import { KnowledgeSidebar } from "@/components/knowledge-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const themeInitScript = `(() => {
  try {
    const storageKey = "kb-theme";
    const saved = localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const theme = saved === "light" || saved === "dark" ? saved : systemTheme;
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("theme-dark", theme === "dark");
    root.classList.toggle("theme-light", theme === "light");
    root.style.colorScheme = theme;
  } catch (_) {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
    root.style.colorScheme = "light";
  }
})();`;

export const metadata: Metadata = {
  title: "System Design Notes",
  description: "A personal knowledge blog built with Next.js and MDX.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className="theme-light"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body>
        <div className="app-layout">
          <KnowledgeSidebar />
          <div className="main-area">{children}</div>
        </div>
        <ThemeToggle />
      </body>
    </html>
  );
}
