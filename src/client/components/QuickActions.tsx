import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { useWalletStructure } from "../hooks/useWalletStructure.ts";
import { Button } from "./ui/Button.tsx";

/** Dashboard shortcut row: jump straight into the most common tasks. */
export function QuickActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useWalletStructure();
  const wallets = state.phase === "ready" ? state.wallets : [];
  const [walletId, setWalletId] = useState("");

  if (wallets.length === 0) return null;
  const selected = walletId || wallets[0]?.id || "";

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3">
      <div className="wobbly-2 flex items-center gap-1 border-2 border-ink/15 bg-surface p-1">
        <select
          className="bg-transparent px-2 py-1.5 font-semibold text-ink outline-none"
          value={selected}
          aria-label={t("quickActions.pickWallet")}
          onChange={(e) => setWalletId(e.target.value)}
        >
          {wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
            </option>
          ))}
        </select>
        <Button onClick={() => navigate(`/wallets/${selected}?add=1`)}>
          + {t("quickActions.addTransaction")}
        </Button>
      </div>
      <Link
        to="/import"
        className="wobbly inline-flex items-center gap-2 border-2 border-ink/20 bg-surface px-4 py-2 font-display font-semibold text-ink-soft transition-transform hover:rotate-1 hover:text-ink active:scale-95"
      >
        ⬆️ {t("quickActions.import")}
      </Link>
      <Link
        to="/wallets"
        className="wobbly-2 inline-flex items-center gap-2 border-2 border-ink/20 bg-surface px-4 py-2 font-display font-semibold text-ink-soft transition-transform hover:-rotate-1 hover:text-ink active:scale-95"
      >
        🧺 {t("quickActions.manageWallets")}
      </Link>
    </div>
  );
}
