import React, { createContext, useContext } from "react";
import { useShare, UseShare } from "@/hooks/useShare";

const ShareContext = createContext<UseShare | null>(null);

export const ShareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useShare();
  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
};

export function useShareContext(): UseShare {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error("useShareContext must be used within ShareProvider");
  return ctx;
}