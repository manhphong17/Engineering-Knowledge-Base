"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "kb-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // On mount: read initial theme from DOM (already set by inline script) or storage
  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ??
      getInitialTheme();
    const resolved: Theme =
      current === "dark" || current === "light" ? current : "light";
    setTheme(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  // Avoid hydration mismatch: render a placeholder until mounted
  if (!mounted) {
    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme"
        disabled
      >
        <span className="theme-icon" aria-hidden>
          ☀
        </span>
        <span className="theme-label">Theme</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <span className="theme-icon" aria-hidden>
          🌙
        </span>
      ) : (
        <span className="theme-icon" aria-hidden>
          ☀
        </span>
      )}
      <span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
