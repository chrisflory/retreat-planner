const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function getJSON<T = unknown>(url: string, timeoutMs = 45000): Promise<T> {
  const doFetch: typeof fetch = isTauri ? (await import("@tauri-apps/plugin-http")).fetch : window.fetch.bind(window);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (isTauri) headers["User-Agent"] = "RetreatPlanner/1.2 (personal land research)";
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs),
  );
  const res = await Promise.race([doFetch(url, { headers }), timeout]);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function openExternal(url: string) {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}
