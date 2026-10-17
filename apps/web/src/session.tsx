import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MeResponse } from "@boranois/shared";
import { api, ApiError, getToken, setToken } from "./api";

type Session = {
  token: string | null;
  me: MeResponse | null;
  aiAvailable: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Session>(null!);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(getToken);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMe(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      setMe(await api<MeResponse>("/me"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut();
    }
  }, [signOut]);

  useEffect(() => {
    refresh();
  }, [token, refresh]);

  useEffect(() => {
    api<{ ai: boolean }>("/health").then((h) => setAiAvailable(h.ai)).catch(() => {});
  }, []);

  const signIn = (t: string) => {
    setToken(t);
    setTokenState(t);
  };

  return <SessionContext.Provider value={{ token, me, aiAvailable, signIn, signOut, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
