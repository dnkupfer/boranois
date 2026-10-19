import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Member, MeResponse, VerifyResponse } from "@boranois/shared";
import { api, ApiError, getToken, setToken } from "./api";

type Session = {
  token: string | null;
  member: Member | null;
  aiAvailable: boolean;
  emailAvailable: boolean;
  /** Signed in with an e-mail listed in ADMIN_EMAILS. */
  isAdmin: boolean;
  signIn: (token: string, member: Member) => void;
  signOut: () => void;
  setMember: (m: Member) => void;
};

const SessionContext = createContext<Session>(null!);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState(getToken);
  const [member, setMember] = useState<Member | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const signOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setMember(null);
    setIsAdmin(false);
  }, []);

  // No account needed: without a session, start an anonymous one. E-mail is optional, for other devices.
  useEffect(() => {
    if (!token) {
      api<VerifyResponse>("/auth/anon", { body: {} })
        .then((r) => {
          setToken(r.token);
          setTokenState(r.token);
          setMember(r.member);
        })
        .catch(() => {});
      return;
    }
    api<MeResponse>("/me")
      .then((r) => {
        setMember(r.member);
        setIsAdmin(!!r.admin);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) signOut();
      });
  }, [token, signOut]);

  useEffect(() => {
    api<{ ai: boolean; email: boolean }>("/health")
      .then((h) => {
        setAiAvailable(h.ai);
        setEmailAvailable(h.email);
      })
      .catch(() => {});
  }, []);

  const signIn = (t: string, m: Member) => {
    setToken(t);
    setTokenState(t);
    setMember(m);
  };

  return <SessionContext.Provider value={{ token, member, aiAvailable, emailAvailable, isAdmin, signIn, signOut, setMember }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
