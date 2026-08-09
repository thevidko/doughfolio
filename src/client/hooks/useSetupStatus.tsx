import type { SetupStatusResponse } from "@shared/api.ts";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { i18next } from "../i18n/index.ts";
import { apiFetch } from "../lib/api.ts";

type SetupStatusState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "ready"; status: SetupStatusResponse };

type SetupStatusContextValue = SetupStatusState & {
  /** Re-fetch after anything that changes setup/auth state (setup, login, logout). */
  refresh: () => Promise<void>;
};

const SetupStatusContext = createContext<SetupStatusContextValue | null>(null);

/** Loads `/api/setup/status` once and exposes it app-wide with a refresh. */
export function SetupStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SetupStatusState>({ phase: "loading" });

  const refresh = useCallback(async () => {
    try {
      const status = await apiFetch<SetupStatusResponse>("/api/setup/status");
      // The stored language wins over browser detection once setup ran.
      if (status.language && status.language !== i18next.language) {
        await i18next.changeLanguage(status.language);
      }
      setState({ phase: "ready", status });
    } catch {
      setState({ phase: "failed" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SetupStatusContext.Provider value={{ ...state, refresh }}>
      {children}
    </SetupStatusContext.Provider>
  );
}

export function useSetupStatus(): SetupStatusContextValue {
  const value = useContext(SetupStatusContext);
  if (!value) {
    throw new Error("useSetupStatus must be used inside <SetupStatusProvider>");
  }
  return value;
}
