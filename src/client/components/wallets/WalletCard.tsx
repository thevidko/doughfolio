import type { StorageTypeDto, WalletDto, WalletGroupDto } from "@shared/api.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { deleteJson, patchJson } from "../../lib/api.ts";
import { AssetPicker } from "../transactions/AssetPicker.tsx";
import { Button } from "../ui/Button.tsx";
import { InlineNameForm } from "./InlineNameForm.tsx";

type WalletCardProps = {
  wallet: WalletDto;
  groups: WalletGroupDto[];
  storageTypes: StorageTypeDto[];
  /** Previous/next wallet in the same group, for reordering. */
  neighbors: { prev?: WalletDto; next?: WalletDto };
  onChanged: () => Promise<void>;
  onError: (error: unknown) => void;
};

/**
 * One "basket", kept calm on purpose (owner feedback): name + storage chip +
 * the transactions button. All management lives behind the ⚙️ toggle.
 */
export function WalletCard({
  wallet,
  groups,
  storageTypes,
  neighbors,
  onChanged,
  onError,
}: WalletCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const storageType = storageTypes.find((s) => s.id === wallet.storageTypeId);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await onChanged();
    } catch (error) {
      onError(error);
    }
  }

  const swapWith = (other: WalletDto | undefined) => {
    if (!other) return;
    void mutate(async () => {
      // Swap sort positions; two PATCHes are fine at this scale.
      await patchJson(`/api/wallets/${wallet.id}`, { sortOrder: other.sortOrder });
      await patchJson(`/api/wallets/${other.id}`, { sortOrder: wallet.sortOrder });
    });
  };

  const selectClass =
    "wobbly-2 border-2 border-ink/15 bg-cream px-2 py-1 text-sm text-ink-soft focus:border-ink outline-none";

  return (
    <div className="wobbly-2 animate-pop border-2 border-ink/15 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {renaming ? (
            <InlineNameForm
              placeholder={t("wallets.walletNamePlaceholder")}
              initial={wallet.name}
              submitLabel={t("common.save")}
              onSubmit={async (name) => {
                await mutate(() => patchJson(`/api/wallets/${wallet.id}`, { name }));
                setRenaming(false);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <>
              <Link
                to={`/wallets/${wallet.id}`}
                className="font-display text-lg font-bold underline-offset-4 hover:underline"
              >
                {wallet.name}
              </Link>
              {storageType && (
                <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-cream-dark px-2 py-0.5 align-middle text-xs font-semibold text-ink-soft">
                  {storageType.name}
                </span>
              )}
              {wallet.defaultAssetId && (
                <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-dough/30 px-2 py-0.5 align-middle text-xs font-semibold text-dough-dark uppercase">
                  🪙 {wallet.defaultAssetId}
                </span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          aria-label={t("wallets.editWallet")}
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
          className={`px-1 text-lg transition-transform hover:rotate-45 ${editing ? "rotate-45" : ""}`}
        >
          ⚙️
        </button>
      </div>

      <Link
        to={`/wallets/${wallet.id}`}
        className="wobbly mt-3 inline-flex items-center gap-2 border-2 border-ink bg-dough px-4 py-1.5 font-display text-sm font-semibold text-ink transition-transform hover:-rotate-1 active:scale-95"
      >
        📒 {t("wallets.openTransactions")}
      </Link>

      {editing && (
        <div className="animate-pop mt-3 space-y-2 border-ink/10 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={selectClass}
              value={wallet.storageTypeId ?? ""}
              aria-label={t("settings.storageTypes")}
              onChange={(e) =>
                void mutate(() =>
                  patchJson(`/api/wallets/${wallet.id}`, {
                    storageTypeId: e.target.value || null,
                  }),
                )
              }
            >
              <option value="">{t("wallets.noStorageType")}</option>
              {storageTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={wallet.groupId}
              aria-label={t("wallets.title")}
              onChange={(e) =>
                void mutate(() =>
                  patchJson(`/api/wallets/${wallet.id}`, { groupId: e.target.value }),
                )
              }
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-ink-soft">
              {t("wallets.defaultAsset")} · {t("wallets.defaultAssetHint")}
            </span>
            <AssetPicker
              value={
                wallet.defaultAssetId
                  ? { id: wallet.defaultAssetId, symbol: wallet.defaultAssetId, name: "" }
                  : null
              }
              onChange={(asset) =>
                void mutate(() =>
                  patchJson(`/api/wallets/${wallet.id}`, { defaultAssetId: asset?.id ?? null }),
                )
              }
              placeholder={t("transactions.form.assetPlaceholder")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => swapWith(neighbors.prev)}
              aria-label={t("common.moveUp")}
              disabled={!neighbors.prev}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              onClick={() => swapWith(neighbors.next)}
              aria-label={t("common.moveDown")}
              disabled={!neighbors.next}
            >
              ↓
            </Button>
            <Button variant="ghost" onClick={() => setRenaming(true)}>
              {t("common.edit")}
            </Button>
            <Button
              variant="ghost"
              aria-label={t("common.delete")}
              onClick={() => {
                if (confirm(t("wallets.confirmDeleteWallet", { name: wallet.name }))) {
                  void mutate(() => deleteJson(`/api/wallets/${wallet.id}`));
                }
              }}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
