import { useEffect, useState } from "react";
import { useCanvasState } from "./ui";

export type ThemeMode = "auto" | "light" | "dark";
type Resolved = "light" | "dark";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const media = window.matchMedia("(prefers-color-scheme: dark)");

function browserTheme(): Resolved {
  return media.matches ? "dark" : "light";
}

function apply(theme: Resolved) {
  document.documentElement.dataset.theme = theme;
}

function storedMode(): ThemeMode {
  try {
    const raw = localStorage.getItem("retreat-planner:theme");
    const v = raw === null ? "auto" : JSON.parse(raw);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

const initial = storedMode();
apply(initial === "auto" ? browserTheme() : initial);

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useCanvasState<ThemeMode>("theme", "auto");
  const [system, setSystem] = useState<Resolved>(browserTheme);

  useEffect(() => {
    const onMedia = () => setSystem(browserTheme());
    media.addEventListener("change", onMedia);
    return () => media.removeEventListener("change", onMedia);
  }, []);

  useEffect(() => {
    if (!inTauri) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const openedAt = Date.now();
    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        if (cancelled) return;
        const win = getCurrentWindow();
        await win.setTheme(mode === "auto" ? null : mode);
        if (mode !== "auto" || cancelled) return;
        // A theme() read at startup races the desktop theme and can come back
        // light or dark. Follow the system media query instead, and accept a
        // native theme change only after the window has settled.
        const un = await win.onThemeChanged(({ payload }) => {
          if (Date.now() - openedAt < 400) return;
          if (payload === "light" || payload === "dark") setSystem(payload);
        });
        if (cancelled) un();
        else unlisten = un;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [mode]);

  useEffect(() => {
    apply(mode === "auto" ? system : mode);
  }, [mode, system]);

  return [mode, setMode];
}
