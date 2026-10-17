import { useEffect, useState } from "react";

// The extension's content script (apps/extension/connect.js) runs on this site and
// talks to the page with window.postMessage. When it says hello we hand it the
// session token, so members never have to log in to the extension separately.

type ExtMessage = { source: "boranois-ext"; type: "hello" | "connected" };

export function useExtension(token: string | null) {
  const [status, setStatus] = useState<"unknown" | "installed" | "connected">("unknown");

  useEffect(() => {
    const onMessage = (e: MessageEvent<ExtMessage>) => {
      if (e.source !== window || e.data?.source !== "boranois-ext") return;
      if (e.data.type === "hello") {
        setStatus("installed");
        if (token) post({ type: "connect", token });
      }
      if (e.data.type === "connected") setStatus("connected");
    };
    window.addEventListener("message", onMessage);
    post({ type: "ping" });
    return () => window.removeEventListener("message", onMessage);
  }, [token]);

  return status;
}

export function disconnectExtension() {
  post({ type: "disconnect" });
}

function post(msg: Record<string, unknown>) {
  window.postMessage({ source: "boranois-web", ...msg }, window.location.origin);
}
