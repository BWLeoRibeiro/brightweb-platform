"use client";
import { clientTasksDictionary as copy } from "./dictionary";

import { useCallback, useEffect, useRef, useState } from "react";

type ResourceState = "loading" | "ready" | "unavailable" | "error";
type Request = (path: string, init?: RequestInit) => Promise<Response>;
const browserRequest: Request = (path, init) => fetch(path, init);

// Keys survive uncertain network outcomes, but never cross a changed request payload.
export function useClientTaskResource<T>(url: string, request: Request = browserRequest) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<ResourceState>("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const requestKeys = useRef(new Map<string, string>());
  const epoch = useRef(0);
  const mounted = useRef(false);
  const writing = useRef(false);

  const refresh = useCallback(async () => {
    const version = ++epoch.current;
    setData(null);
    setState("loading");
    try {
      const response = await request(url, { cache: "no-store" });
      if (!mounted.current || epoch.current !== version) return;
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        requestKeys.current.clear();
        setState("unavailable");
        return;
      }
      const payload = await response.json();
      if (!mounted.current || epoch.current !== version) return;
      if (!response.ok || !payload || !("data" in payload)) throw new Error("Invalid task response");
      setData(payload.data as T);
      setState("ready");
    } catch {
      if (mounted.current && epoch.current === version) setState("error");
    }
  }, [request, url]);

  useEffect(() => {
    mounted.current = true;
    requestKeys.current.clear();
    setMessage("");
    void refresh();
    const onFocus = () => { if (!writing.current) void refresh(); };
    window.addEventListener("focus", onFocus);
    const onVisible = () => { if (document.visibilityState === "visible") onFocus(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      epoch.current += 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const mutate = async (path: string, method: "POST" | "PATCH", body: { expectedRevision: number | null; action: string; input: object }) => {
    if (writing.current) return false;
    writing.current = true;
    setBusy(true);
    setMessage("");
    const version = ++epoch.current;
    const fingerprint = JSON.stringify([path, method, body]);
    const requestId = requestKeys.current.get(fingerprint) ?? crypto.randomUUID();
    requestKeys.current.set(fingerprint, requestId);
    try {
      const response = await request(path, {
        method, cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId }),
      });
      if (!mounted.current || epoch.current !== version) return false;
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        setData(null);
        setState("unavailable");
        requestKeys.current.clear();
        setMessage(copy.accessLost);
        return false;
      }
      if (response.status === 409) {
        requestKeys.current.delete(fingerprint);
        setMessage(copy.conflict);
        await refresh();
        return false;
      }
      if (!response.ok) {
        setMessage(copy.saveError);
        return false;
      }
      requestKeys.current.delete(fingerprint);
      await refresh();
      return true;
    } catch {
      if (mounted.current && epoch.current === version) setMessage(copy.uncertain);
      return false;
    } finally {
      writing.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { data, state, message, busy, refresh, mutate };
}
