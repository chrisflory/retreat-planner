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

function asResolved(v: unknown): Resolved | null {
  return v === "dark" || v === "light" ? v : null;
}

const initial = storedMode();
// The desktop webview's prefers-color-scheme stays light when the GTK theme
// is named "Breeze", even if the desktop is dark. Don't paint from it.
if (!inTauri) apply(initial === "auto" ? browserTheme() : initial);
else if (initial !== "auto") apply(initial);

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useCanvasState<ThemeMode>("theme", "auto");
  const [system, setSystem] = useState<Resolved | null>(inTauri ? null : browserTheme());

  useEffect(() => {
    if (inTauri) return;
    const onMedia = () => setSystem(browserTheme());
    media.addEventListener("change", onMedia);
    return () => media.removeEventListener("change", onMedia);
  }, []);

  useEffect(() => {
    if (!inTauri) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const linux = navigator.userAgent.includes("Linux");
    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        if (cancelled) return;
        const win = getCurrentWindow();
        if (mode !== "auto") {
          await win.setTheme(mode);
          return;
        }
        // setTheme(null) clears a Light/Dark override so theme() reads the
        // desktop again. On Linux that call also turns
        // gtk-application-prefer-dark-theme off, which paints a dark desktop
        // light. Put the desktop scheme back explicitly.
        await win.setTheme(null);
        if (cancelled) return;
        const desktop = asResolved(await win.theme()) ?? "light";
        if (linux) await win.setTheme(desktop);
        if (cancelled) return;
        setSystem(desktop);
        const settled = Date.now();
        const un = await win.onThemeChanged(({ payload }) => {
          const next = asResolved(payload);
          if (!next) return;
          if (linux && Date.now() - settled < 500 && next !== desktop) return;
          setSystem(next);
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
    if (mode !== "auto") {
      apply(mode);
      return;
    }
    if (system) apply(system);
  }, [mode, system]);

  return [mode, setMode];
}
