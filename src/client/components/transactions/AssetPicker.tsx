import type { AssetDto, AssetSearchResponse } from "@shared/api.ts";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api.ts";
import { TextInput } from "../ui/TextInput.tsx";

type AssetPickerProps = {
  value: AssetDto | null;
  onChange: (asset: AssetDto | null) => void;
  placeholder: string;
  inputId?: string;
};

/** Debounced search over the cached CoinGecko catalog with a dropdown. */
export function AssetPicker({ value, onChange, placeholder, inputId }: AssetPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetDto[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const needle = query.trim();
    if (needle.length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(() => {
      apiFetch<AssetSearchResponse>(`/api/assets?query=${encodeURIComponent(needle)}`)
        .then((res) => {
          setResults(res.assets);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  if (value) {
    return (
      <button
        type="button"
        className="wobbly-2 flex w-full items-center justify-between border-2 border-ink bg-dough/30 px-4 py-2.5 text-left"
        onClick={() => {
          onChange(null);
          setQuery("");
        }}
        aria-label={t("common.edit")}
      >
        <span>
          <span className="font-display font-bold">{value.symbol.toUpperCase()}</span>{" "}
          <span className="text-sm text-ink-soft">{value.name}</span>
        </span>
        <span aria-hidden>✕</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <TextInput
        id={inputId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="wobbly-3 absolute z-10 mt-1 max-h-56 w-full overflow-y-auto border-2 border-ink/20 bg-surface shadow-md">
          {results.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-4 py-2 text-left hover:bg-cream-dark"
                onMouseDown={() => {
                  onChange(asset);
                  setOpen(false);
                }}
              >
                <span className="font-display font-bold">{asset.symbol.toUpperCase()}</span>
                <span className="truncate text-sm text-ink-soft">{asset.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
