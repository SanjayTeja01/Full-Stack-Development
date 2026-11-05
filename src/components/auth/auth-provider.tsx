"use client";

import * as React from "react";
import { onIdTokenChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { firebase } from "@/lib/firebase/client";
import type { Role, UserProfile } from "@shared/types";

export type AuthStatus = "loading" | "signed_out" | "needs_onboarding" | "ready";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  role: Role | null;
  profile: UserProfile | null;
  /** True when the session ended without the user signing out (token revoked, account disabled). */
  sessionExpired: boolean;
  refreshClaims: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [role, setRole] = React.useState<Role | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const intentionalSignOut = React.useRef(false);
  const hadUser = React.useRef(false);

  React.useEffect(() => {
    const { auth } = firebase();
    return onIdTokenChanged(auth, async (u) => {
      if (!u) {
        if (hadUser.current && !intentionalSignOut.current) setSessionExpired(true);
        hadUser.current = false;
        intentionalSignOut.current = false;
        setUser(null);
        setRole(null);
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      hadUser.current = true;
      setSessionExpired(false);
      setProfileLoading(true);
      const token = await u.getIdTokenResult();
      const claimRole = token.claims.role;
      const nextRole = claimRole === "farmer" || claimRole === "buyer" || claimRole === "admin" ? claimRole : null;
      setRole(nextRole);
      if (!nextRole) setProfileLoading(false);
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  React.useEffect(() => {
    if (!user || !role) return;
    const { db } = firebase();
    return onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false),
    );
  }, [user, role]);

  const refreshClaims = React.useCallback(async () => {
    const u = firebase().auth.currentUser;
    if (!u) return;
    await u.getIdToken(true);
    const token = await u.getIdTokenResult();
    const claimRole = token.claims.role;
    const nextRole = claimRole === "farmer" || claimRole === "buyer" || claimRole === "admin" ? claimRole : null;
    if (nextRole) setProfileLoading(true);
    setRole(nextRole);
  }, []);

  const signOut = React.useCallback(async () => {
    intentionalSignOut.current = true;
    await fbSignOut(firebase().auth);
  }, []);

  let status: AuthStatus;
  if (authLoading) status = "loading";
  else if (!user) status = "signed_out";
  else if (!role) status = "needs_onboarding";
  else if (profileLoading || (!profile && role !== "admin")) status = profileLoading ? "loading" : "needs_onboarding";
  else status = "ready";

  const value = React.useMemo<AuthState>(
    () => ({ status, user, role, profile, sessionExpired, refreshClaims, signOut }),
    [status, user, role, profile, sessionExpired, refreshClaims, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function dashboardPathFor(role: Role | null): string {
  if (role === "farmer") return "/farmer";
  if (role === "buyer") return "/buyer";
  if (role === "admin") return "/admin";
  return "/onboarding";
}
