import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Member, MeResponse } from "@boranois/shared";
import { api, ApiError, getToken, setToken } from "./api";

type Session = {
  token: string | null;
  member: Member | null;
  aiAvailable: boolean;
  signIn: (token: string, member: Member) => void;
  signOut: () => void;
  setMember: (m: Member) => void;
};

const SessionContext = createContext<Session>(null!);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(getToken);
  const [member, setMember] = useState<Member | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMember(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    api<MeResponse>("/me")
      .then((r) => setMember(r.member))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) signOut();
      });
  }, [token, signOut]);

  useEffect(() => {
    api<{ ai: boolean }>("/health").then((h) => setAiAvailable(h.ai)).catch(() => {});
  }, []);

  const signIn = (t: string, m: Member) => {
    setToken(t);
    setTokenState(t);
    setMember(m);
  };

  return <SessionContext.Provider value={{ token, member, aiAvailable, signIn, signOut, setMember }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
