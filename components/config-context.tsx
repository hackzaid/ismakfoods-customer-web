"use client";

import { createContext, useContext } from "react";
import type { AppConfig, Branch } from "@/lib/api";
import { useStore } from "@/lib/store";

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ config, children }: { config: AppConfig | null; children: React.ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}

/** The branch the customer is ordering from: their saved choice, else the first branch. */
export function useBranch(): Branch | null {
  const config = useConfig();
  const { branchId } = useStore();
  const branches = config?.branches ?? [];
  return branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
}
