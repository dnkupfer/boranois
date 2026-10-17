import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { MeResponse } from "@boranois/shared";
import { api, ApiError, getToken, setToken } from "./api";
import { disconnectExtension, useExtension } from "./extension";

type Session = {
  token: string | null;
  me: MeResponse | null;
  extension: ReturnType<typeof useExtension>;
  signIn: (token: string) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<Session>(null!);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(getToken);
  const [me, setMe] = useState<MeResponse | null>(null);
  const extension = useExtension(token);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMe(null);
    disconnectExtension();
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

  const signIn = (t: string) => {
    setToken(t);
    setTokenState(t);
  };

  return (
    <SessionContext.Provider value={{ token, me, extension, signIn, signOut, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
