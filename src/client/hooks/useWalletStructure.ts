import type {
  StorageTypeListResponse,
  WalletGroupListResponse,
  WalletListResponse,
} from "@shared/api.ts";
import { useCallback, useEffect, useState } from "react";
import { translateServerKey } from "../i18n/index.ts";
import { ApiRequestError, apiFetch } from "../lib/api.ts";

type StructureState =
  | { phase: "loading" }
  | { phase: "failed"; message: string }
  | {
      phase: "ready";
      groups: WalletGroupListResponse["groups"];
      wallets: WalletListResponse["wallets"];
      storageTypes: StorageTypeListResponse["storageTypes"];
    };

/**
 * Loads the whole wallet structure (groups + wallets + storage types) and
 * exposes `reload` — mutations call the API directly and then reload; at this
 * data size, refetching beats cache bookkeeping.
 */
export function useWalletStructure() {
  const [state, setState] = useState<StructureState>({ phase: "loading" });

  const reload = useCallback(async () => {
    try {
      const [groups, wallets, storageTypes] = await Promise.all([
        apiFetch<WalletGroupListResponse>("/api/groups"),
        apiFetch<WalletListResponse>("/api/wallets"),
        apiFetch<StorageTypeListResponse>("/api/storage-types"),
      ]);
      setState({
        phase: "ready",
        groups: groups.groups,
        wallets: wallets.wallets,
        storageTypes: storageTypes.storageTypes,
      });
    } catch (error) {
      setState({
        phase: "failed",
        message: translateServerKey(
          error instanceof ApiRequestError ? error.messageKey : "errors.network",
        ),
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
