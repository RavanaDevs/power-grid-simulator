"use client";
import { useState } from "react";
import { AlertTriangle, Info, Zap, Crosshair } from "lucide-react";
import type { State, Notice } from "@/game/engine";
import { gridTime, translate, type Language } from "@/game/i18n";
export default function NotificationLog({
  state,
  language,
  onSelect,
}: {
  state: State;
  language: Language;
  onSelect: (e: Notice) => void;
}) {
  const t = translate(language),
    [filter, setFilter] = useState("all");
  const events = state.events.filter(
    (e) =>
      filter === "all" ||
      (filter === "alerts" && e.level !== "info") ||
      (filter === "critical" && e.level === "critical"),
  );
  return (
    <div className="notification-log">
      <div className="window-tabs">
        {[
          ["all", "All events", "සියලු සිදුවීම්"],
          ["alerts", "Alerts", "අනතුරු ඇඟවීම්"],
          ["critical", "Critical", "තීරණාත්මක"],
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
      <p className="log-hint">
        {t(
          "Newest first · select an event to locate it",
          "අලුත්ම සිදුවීම් මුලින් · සිතියමේ බැලීමට තෝරන්න",
        )}
      </p>
      <div className="event-list">
        {events.map((e) => (
          <button
            key={e.id}
            className={`event-row ${e.level}`}
            onClick={() => onSelect(e)}
          >
            <span className="event-symbol">
              {e.level === "critical" ? (
                <Zap size={15} />
              ) : e.level === "warning" ? (
                <AlertTriangle size={15} />
              ) : (
                <Info size={15} />
              )}
            </span>
            <span>
              <time>
                {gridTime(e.time)}
                <small>{e.asset ?? t("GRID", "ජාලය")}</small>
              </time>
              <b>{language === "si" ? e.textSi : e.text}</b>
            </span>
            <Crosshair size={13} />
          </button>
        ))}
        {!events.length && (
          <p className="empty-state">
            {t(
              "No events in this category yet.",
              "මෙම කාණ්ඩයේ සිදුවීම් තවම නැත.",
            )}
          </p>
        )}
      </div>
    </div>
  );
}
