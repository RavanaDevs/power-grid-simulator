"use client";
import { useState } from "react";
import { forecastAt, type State } from "@/game/engine";
import { translate, gridTime, type Language } from "@/game/i18n";
export default function Forecast({
  state,
  language,
  compact = false,
}: {
  state: State;
  language: Language;
  compact?: boolean;
}) {
  const t = translate(language),
    [hover, setHover] = useState<number | null>(null),
    [table, setTable] = useState(false);
  const start = Math.max(28800, state.time - 3 * 3600),
    end = Math.min(115200, state.time + 6 * 3600),
    span = Math.max(1, end - start);
  const future = Array.from({ length: 49 }, (_, i) =>
    forecastAt(state, start + (span * i) / 48),
  );
  const past = state.history.filter((p) => p.time >= start);
  const max =
    Math.ceil(
      Math.max(
        ...future.map((p) => Math.max(p.demand, p.generation)),
        ...past.map((p) => Math.max(p.demand, p.generation)),
        100,
      ) / 250,
    ) * 250;
  const x = (time: number) => 44 + ((time - start) / span) * 700,
    y = (v: number) => 180 - (v / max) * 152;
  const path = (points: { time: number; value: number }[]) =>
    points
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`,
      )
      .join(" ");
  const expectedDemand = [
    ...past.map((p) => ({ time: p.time, value: p.forecastDemand })),
    ...future
      .filter((p) => p.time > state.time)
      .map((p) => ({ time: p.time, value: p.demand })),
  ];
  const expectedGeneration = [
    ...past.map((p) => ({ time: p.time, value: p.forecastGeneration })),
    ...future
      .filter((p) => p.time > state.time)
      .map((p) => ({ time: p.time, value: p.generation })),
  ];
  const selectedTime = hover === null ? null : start + span * hover;
  const closest =
    selectedTime === null
      ? null
      : past.reduce<(typeof past)[number] | null>(
          (a, p) =>
            !a ||
            Math.abs(p.time - selectedTime) < Math.abs(a.time - selectedTime)
              ? p
              : a,
          null,
        );
  const prediction =
    selectedTime === null ? null : forecastAt(state, selectedTime);
  return (
    <div className={compact ? "curve-view compact-curve" : "curve-view"}>
      <div className="curve-legend">
        <span className="actual-demand">
          {t("Demand · actual", "ඉල්ලුම · සැබෑ")}
        </span>
        <span className="actual-generation">
          {t("Supply · actual", "සැපයුම · සැබෑ")}
        </span>
        <span className="pred-demand">
          {t("Demand · forecast", "ඉල්ලුම · පුරෝකථන")}
        </span>
        <span className="pred-generation">
          {t("Supply · plan", "සැපයුම · සැලසුම")}
        </span>
      </div>
      <svg
        role="img"
        aria-label={t(
          "Actual and forecast power in megawatts over time",
          "කාලය අනුව සැබෑ හා පුරෝකථිත බලය මෙගාවොට්වලින්",
        )}
        viewBox="0 0 770 210"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.max(
              0,
              Math.min(1, (((e.clientX - r.left) / r.width) * 770 - 44) / 700),
            ),
          );
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line
              x1="44"
              x2="744"
              y1={y(v * max)}
              y2={y(v * max)}
              stroke="#b8d9af18"
            />
            <text x="36" y={y(v * max) + 4} textAnchor="end">
              {Math.round(v * max)}
            </text>
          </g>
        ))}
        <text x="44" y="14">
          MW
        </text>
        <path d={path(expectedDemand)} stroke="#c99559" strokeDasharray="5 5" />
        <path
          d={path(expectedGeneration)}
          stroke="#65b9c1"
          strokeDasharray="5 5"
        />
        <path
          d={path(past.map((p) => ({ time: p.time, value: p.demand })))}
          stroke="#ffd196"
        />
        <path
          d={path(past.map((p) => ({ time: p.time, value: p.generation })))}
          stroke="#d0f09b"
        />
        <line
          x1={x(state.time)}
          x2={x(state.time)}
          y1="23"
          y2="184"
          stroke="#e8ecd877"
          strokeDasharray="3 3"
        />
        <text x={Math.min(700, x(state.time) + 6)} y="22">
          {t("NOW", "දැන්")}
        </text>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={44 + 700 * v} y="204" textAnchor="middle">
            {gridTime(start + span * v)}
          </text>
        ))}
        {hover !== null && (
          <line
            x1={44 + 700 * hover}
            x2={44 + 700 * hover}
            y1="24"
            y2="184"
            stroke="#f0cd8580"
          />
        )}
      </svg>
      {prediction && (
        <div className="curve-tooltip">
          {gridTime(prediction.time)} · {t("Forecast", "පුරෝකථනය")}:{" "}
          {Math.round(prediction.demand)} / {Math.round(prediction.generation)}{" "}
          MW{" "}
          {selectedTime! <= state.time && closest
            ? ` · ${t("Actual", "සැබෑ")}: ${Math.round(closest.demand)} / ${Math.round(closest.generation)} MW`
            : ""}
        </div>
      )}
      {!compact && (
        <>
          <p className="chart-note">
            {t(
              "Dashed supply is your saved dispatch plan, not a promise. Clouds, outages, empty reservoirs, and storage limits change actual supply. Update the plan after redispatching.",
              "කඩ ඉරි සැපයුම ඔබ සුරැකි ජනන සැලසුමයි. වලාකුළු, දෝෂ, ජල හා බැටරි සීමා නිසා සැබෑ සැපයුම වෙනස් වේ. ජනනය වෙනස් කළ පසු සැලසුම යාවත්කාලීන කරන්න.",
            )}
          </p>
          <button className="text-button" onClick={() => setTable(!table)}>
            {table
              ? t("Hide readings", "දත්ත සඟවන්න")
              : t("Show recent readings", "මෑත දත්ත පෙන්වන්න")}
          </button>
          {table && (
            <table className="readings">
              <thead>
                <tr>
                  <th>{t("Time", "වේලාව")}</th>
                  <th>{t("Demand MW", "ඉල්ලුම MW")}</th>
                  <th>{t("Supply MW", "සැපයුම MW")}</th>
                  <th>Hz</th>
                </tr>
              </thead>
              <tbody>
                {past.slice(-6).map((p) => (
                  <tr key={p.time}>
                    <td>{gridTime(p.time)}</td>
                    <td>{Math.round(p.demand)}</td>
                    <td>{Math.round(p.generation)}</td>
                    <td>{p.frequency.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
