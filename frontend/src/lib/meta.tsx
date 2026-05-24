"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";
import type { Meta } from "./types";

const MetaContext = createContext<Meta | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    api.get<Meta>("/api/meta").then(setMeta).catch(() => {});
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export function useMeta(): Meta | null {
  return useContext(MetaContext);
}
