"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api, setTokens, clearTokens, getAccessToken } from "./api";
import type { User, Agency } from "./types";

interface AuthState {
  user: User | null;
  agency: Agency | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export interface RegisterPayload {
  agencyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  agency: Agency;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ user: User; agency: Agency }>("/api/auth/me");
      setUser(data.user);
      setAgency(data.agency);
    } catch {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (email: string, password: string) => {
    const data = await api.post<AuthResponse>("/api/auth/login", { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setAgency(data.agency);
  };

  const register = async (payload: RegisterPayload) => {
    const data = await api.post<AuthResponse>("/api/auth/register", payload);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    setAgency(data.agency);
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    setAgency(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const refresh = async () => {
    const data = await api.get<{ user: User; agency: Agency }>("/api/auth/me");
    setUser(data.user);
    setAgency(data.agency);
  };

  return (
    <AuthContext.Provider value={{ user, agency, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
