"use client";
import { useState } from "react";
import {
  BatteryCharging,
  Droplets,
  Flame,
  Sun,
  Wind,
  Search,
  Crosshair,
  Activity,
} from "lucide-react";
import type { State } from "@/game/engine";
import { assetName, kindName, translate, type Language } from "@/game/i18n";
export default function Fleet({
  state,
  language,
  selected,
  onSelect,
}: {
  state: State;
  language: Language;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const t = translate(language),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const plants = state.assets.filter((a) => !["bus", "load"].includes(a.kind));
  const filtered = plants.filter(
    (a) =>
      (filter === "all" ||
        (filter === "offline" && !a.online) ||
        (filter === "hydro" && a.kind === "hydro")) &&
      `${a.name} ${a.nameSi} ${a.id}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="fleet-roster plant-dock">
      <div className="fleet-summary">
        <Activity size={16} />
        <strong>
          {plants.filter((a) => a.online).length}
          <small> / {plants.length}</small>
        </strong>
        <span>{t("units online", "සක්‍රිය ඒකක")}</span>
        <b>{Math.round(state.generation)} MW</b>
      </div>
      <label className="fleet-search">
        <Search size={14} />
        <input
          aria-label={t("Search power plants", "බලාගාර සොයන්න")}
          placeholder={t("Find a power plant…", "බලාගාරයක් සොයන්න…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="window-tabs">
        {[
          ["all", "All units", "සියල්ල"],
          ["hydro", "Hydro", "ජල"],
          ["offline", "Offline", "විසන්ධි"],
        ].map(([id, en, si]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {t(en, si)}
          </button>
        ))}
      </div>
      <div className="fleet-list">
        {filtered.map((a) => {
          const Icon =
            a.kind === "hydro"
              ? Droplets
              : a.kind === "wind"
                ? Wind
                : a.kind === "solar"
                  ? Sun
                  : a.kind === "battery"
                    ? BatteryCharging
                    : Flame;
          return (
            <button
              key={a.id}
              className={`fleet-unit ${selected === a.id ? "selected" : ""} ${!a.online ? "offline" : ""}`}
              aria-label={assetName(a, language)}
              onClick={() => onSelect(a.id)}
            >
              <span className={`unit-icon ${a.kind}`}>
                <Icon size={19} />
              </span>
              <span className="unit-name">
                <b>{assetName(a, language)}</b>
                <small>
                  {kindName(a.kind, language)} ·{" "}
                  {a.online ? t("Online", "සක්‍රිය") : t("Offline", "විසන්ධි")}
                </small>
                <i>
                  <em
                    style={{
                      width: `${Math.min(100, (Math.abs(a.output) / a.capacity) * 100)}%`,
                    }}
                  />
                </i>
              </span>
              <span className="unit-output">
                <b>{Math.round(a.output)}</b>
                <small>MW</small>
              </span>
              <Crosshair size={12} />
            </button>
          );
        })}
        {!filtered.length && (
          <p className="empty-state">
            {t("No matching units.", "ගැළපෙන ඒකක නැත.")}
          </p>
        )}
      </div>
    </div>
  );
}
