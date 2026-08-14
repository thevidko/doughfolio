import type { SettingsResponse } from "@shared/api.ts";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, patchJson } from "../../lib/api.ts";
import { Card } from "../ui/Card.tsx";

/** Cost-basis method and staking-reward valuation (portfolio-analytics spec). */
export function PlPreferences() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    apiFetch<SettingsResponse>("/api/settings")
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  if (!settings) return null;

  async function update(patch: Partial<SettingsResponse>) {
    const next = await patchJson<SettingsResponse>("/api/settings", patch);
    setSettings(next);
  }

  const selectClass =
    "wobbly-2 w-full max-w-xs border-2 border-ink-soft/60 bg-cream px-3 py-2 text-ink outline-none focus:border-ink";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{t("settingsPl.title")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("settingsPl.hint")}</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-soft">
          {t("settingsPl.costBasisMethod")}
        </span>
        <select
          className={selectClass}
          value={settings.costBasisMethod}
          onChange={(e) =>
            void update({ costBasisMethod: e.target.value as SettingsResponse["costBasisMethod"] })
          }
        >
          <option value="average">{t("settingsPl.average")}</option>
          <option value="fifo">{t("settingsPl.fifo")}</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink-soft">
          {t("settingsPl.rewardBasis")}
        </span>
        <select
          className={selectClass}
          value={settings.stakingRewardCostBasis}
          onChange={(e) =>
            void update({
              stakingRewardCostBasis: e.target.value as SettingsResponse["stakingRewardCostBasis"],
            })
          }
        >
          <option value="market">{t("settingsPl.market")}</option>
          <option value="zero">{t("settingsPl.zero")}</option>
        </select>
      </label>
    </Card>
  );
}
