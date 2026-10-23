"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Zap,
  Play,
  Pause,
  Plus,
  Minus,
  X,
  Volume2,
  VolumeX,
  Settings,
  RotateCcw,
  Save,
  CloudLightning,
  Sun,
  ChevronRight,
  ArrowUpRight,
  BatteryCharging,
  Flame,
  Droplets,
  Check,
  Maximize,
  Flag,
  Wind,
  Star,
  BookOpen,
  TrendingUp,
  Leaf,
  Coins,
  PanelsTopLeft,
  Bell,
  Factory,
  Crosshair,
} from "lucide-react";
import {
  createState,
  CLOCK_RATE,
  validSave,
  type State,
  type Command,
  type Notice,
} from "@/game/engine";
import {
  SCENARIOS,
  RELAYS,
  secondsToTrip,
  type ScenarioId,
} from "@/game/protection";
import { TECH, ECONOMY } from "@/game/network";
import {
  assetName,
  kindName,
  translate,
  gridTime,
  type Language,
} from "@/game/i18n";
import { GameAudio } from "@/game/audio";
import GuidedTour from "@/components/GuidedTour";
import Forecast from "@/components/Forecast";
import GameWindow from "@/components/GameWindow";
import Fleet from "@/components/Fleet";
import NotificationLog from "@/components/NotificationLog";
import Restoration from "@/components/Restoration";
const World = dynamic(() => import("@/components/GridMap"), { ssr: false });
const number = (v: number) => Math.round(v).toLocaleString("en-US");
function Icon({ kind, size = 20 }: { kind: string; size?: number }) {
  return kind === "coal" || kind === "oil" ? (
    <Flame size={size} />
  ) : kind === "hydro" ? (
    <Droplets size={size} />
  ) : kind === "solar" ? (
    <Sun size={size} />
  ) : kind === "wind" ? (
    <Wind size={size} />
  ) : (
    <BatteryCharging size={size} />
  );
}
export default function Game() {
  const [state, setState] = useState<State>(createState),
    [language, setLanguage] = useState<Language>("en"),
    [selected, setSelected] = useState(""),
    [screen, setScreen] = useState("briefing"),
    [started, setStarted] = useState(false),
    [ready, setReady] = useState(false),
    [zoom, setZoom] = useState(1),
    [reset, setReset] = useState(0),
    [focus, setFocus] = useState(0),
    [windows, setWindows] = useState<Record<string, boolean>>({
      mission: true,
      grid: true,
      fleet: true,
      inspector: true,
    }),
    [windowTokens, setWindowTokens] = useState<Record<string, number>>({}),
    [folds, setFolds] = useState<Record<string, number>>({}),
    [menu, setMenu] = useState(false),
    [layout, setLayout] = useState(0),
    [sound, setSound] = useState(true),
    [volume, setVolume] = useState(0.45),
    [prefs, setPrefs] = useState(false),
    [tour, setTour] = useState<number | null>(null),
    [showTour, setShowTour] = useState(true),
    [tourTarget, setTourTarget] = useState(115),
    [difficulty, setDifficulty] = useState("normal"),
    [scenario, setScenario] = useState<ScenarioId>("first-shift"),
    [toast, setToast] = useState(""),
    [saved, setSaved] = useState(false),
    [layer, setLayer] = useState("flow");
  const t = translate(language),
    worker = useRef<Worker | null>(null),
    audio = useRef<GameAudio | null>(null),
    snapshot = useRef(state),
    lastEvent = useRef(1),
    resultPlayed = useRef(false);
  const titleFor = (id: string) =>
    ({
      restoration: t("Black-start procedures", "ස්වයං ආරම්භක පියවර"),
      mission: t("Mission", "මෙහෙයුම"),
      grid: t("Grid balance", "ජාල සමතුලිතතාව"),
      fleet: t("Power fleet", "බලාගාර සමූහය"),
      inspector: t("Inspector", "පරීක්ෂකය"),
      curves: t("Supply & demand", "සැපයුම හා ඉල්ලුම"),
      economy: t("Resources & economy", "සම්පත් හා ආර්ථිකය"),
      timeline: t("Notification log", "දැනුම්දීම් සටහන"),
    })[id] ?? id;
  const openWindow = (id: string) => {
    setFolds((v) => ({ ...v, [id]: 0 }));
    setWindows((v) => ({ ...v, [id]: true }));
    setWindowTokens((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
  };
  const closeWindow = (id: string) =>
    setWindows((v) => ({ ...v, [id]: false }));
  const setPanel = (id: string) => {
    if (id) openWindow(id);
    else
      setWindows((v) => ({
        ...v,
        curves: false,
        economy: false,
        timeline: false,
      }));
  };
  const win = (id: string) => ({
    id,
    title: titleFor(id),
    language,
    onClose: () => closeWindow(id),
    openToken: windowTokens[id] ?? 0,
    layout,
    foldToken: folds[id] ?? 0,
  });
  snapshot.current = state;
  useEffect(() => {
    const w = new Worker(
      new URL("../../game/simulation.worker.ts", import.meta.url),
    );
    worker.current = w;
    audio.current = new GameAudio();
    w.onmessage = (e: MessageEvent<State>) => {
      setState(e.data);
      setReady(true);
    };
    w.onerror = () =>
      setToast("Simulation unavailable / අනුකරණය ක්‍රියාත්මක කළ නොහැක");
    try {
      const l = localStorage.getItem("grid-language");
      if (l === "si") setLanguage(l);
      const p = JSON.parse(localStorage.getItem("grid-audio-v1") || "null");
      if (p) {
        setSound(p.enabled !== false);
        setVolume(
          Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : 0.45,
        );
      }
      setShowTour(localStorage.getItem("grid-tour-v2") !== "done");
      setSaved(!!localStorage.getItem("grid-save-v2"));
    } catch {}
    setPrefs(true);
    const timer = setInterval(() => {
      if (snapshot.current.time > 28800)
        try {
          localStorage.setItem(
            "grid-autosave-v2",
            JSON.stringify(snapshot.current),
          );
        } catch {}
    }, 15000);
    return () => {
      w.terminate();
      audio.current?.dispose();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("grid-language", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    if (!prefs) return;
    audio.current?.configure(sound, volume);
    try {
      localStorage.setItem(
        "grid-audio-v1",
        JSON.stringify({ enabled: sound, volume }),
      );
    } catch {}
  }, [sound, volume, prefs]);
  useEffect(() => {
    audio.current?.environment(
      started && !state.paused && !screen && tour === null,
      state.weather === "Storm front",
    );
    const hide = () =>
      audio.current?.environment(
        !document.hidden &&
          started &&
          !snapshot.current.paused &&
          !screen &&
          tour === null,
        snapshot.current.weather === "Storm front",
      );
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [started, state.paused, state.weather, screen, tour]);
  useEffect(() => {
    const fresh = state.events.filter((e) => e.id > lastEvent.current);
    lastEvent.current = state.events[0]?.id ?? 0;
    if (fresh.some((e) => e.level === "critical")) audio.current?.play("trip");
    else if (fresh.some((e) => e.level === "warning"))
      audio.current?.play("warning");
    if (state.finished && !resultPlayed.current) {
      resultPlayed.current = true;
      audio.current?.play(state.outcome === "blackout" ? "failure" : "success");
      setSelected("");
      setPanel("");
      setScreen("");
    }
  }, [state.events, state.finished, state.outcome]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        ["INPUT", "SELECT", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        tour !== null
      )
        return;
      if (
        e.code === "Space" &&
        started &&
        !screen &&
        !snapshot.current.finished
      ) {
        e.preventDefault();
        worker.current?.postMessage({ type: "pause" });
      }
      if (e.code === "Escape") {
        setScreen("");
        setPanel("");
        setSelected("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [started, screen, tour]);
  const send = (c: Command) => {
    if (c.type === "pause" && tour !== null) return;
    worker.current?.postMessage(c);
    if (c.type === "target") audio.current?.play("dispatch");
    if (c.type === "toggle") audio.current?.play("breaker");
    if (c.type === "upgrade") audio.current?.play("upgrade");
  };
  const choose = (id: string) => {
    setSelected(id);
    if (id) openWindow("inspector");
    setFolds((v) => ({
      ...v,
      curves: (v.curves ?? 0) + 1,
      economy: (v.economy ?? 0) + 1,
      timeline: (v.timeline ?? 0) + 1,
    }));
    setFocus((v) => v + 1);
    audio.current?.play("select");
  };
  const locateEvent = (e: Notice) => {
    const bus = state.busFrequency.reduce(
      (best, f, i) =>
        Math.abs(f - 50) > Math.abs(state.busFrequency[best] - 50) ? i : best,
      0,
    );
    choose(e.asset ?? `S${bus + 1}`);
  };
  const begin = () => {
    audio.current?.unlock();
    audio.current?.configure(sound, volume);
    audio.current?.play("start");
    resultPlayed.current = false;
    lastEvent.current = 1;
    send({ type: "reset", difficulty, scenario });
    setStarted(true);
    setWindows({
      mission: true,
      grid: true,
      fleet: scenario !== "black-start",
      inspector: true,
      restoration: scenario === "black-start",
    });
    setSelected("");
    setPanel("");
    setScreen("");
    setReset((v) => v + 1);
    if (showTour && scenario !== "black-start") {
      setTourTarget(115);
      setTour(0);
    } else send({ type: "pause" });
  };
  const finishTour = () => {
    setTour(null);
    setSelected("");
    setShowTour(false);
    try {
      localStorage.setItem("grid-tour-v2", "done");
    } catch {}
    setToast(
      t(
        "Training complete. Press Play when ready.",
        "පුහුණුව අවසන්. සූදානම් වූ විට ක්‍රීඩාව අරඹන්න.",
      ),
    );
  };
  const tourStep = (n: number) => {
    setTour(n);
    if (n === 1) {
      setSelected("");
      openWindow("fleet");
    }
    if (n === 2) choose("G2");
    if (n === 3) choose("L4");
    if (n === 4) choose("B1");
    if (n === 5) setSelected("");
  };
  const open = (name: string) => {
    if (tour !== null) return;
    if (!state.paused && !state.finished) send({ type: "pause" });
    setScreen(name);
  };
  const save = () => {
    try {
      localStorage.setItem("grid-save-v2", JSON.stringify(state));
      setSaved(true);
      audio.current?.play("save");
      setToast(
        t("Progress saved on this device.", "ප්‍රගතිය මෙම උපාංගයේ සුරැකුණි."),
      );
    } catch {
      setToast(t("Saving unavailable.", "සුරැකීම කළ නොහැක."));
    }
  };
  const load = () => {
    try {
      const raw =
        localStorage.getItem("grid-save-v2") ||
        localStorage.getItem("grid-autosave-v2");
      if (!raw) throw Error();
      const s: unknown = JSON.parse(raw);
      if (!validSave(s)) throw Error();
      audio.current?.unlock();
      lastEvent.current = s.events[0]?.id ?? 0;
      resultPlayed.current = s.finished;
      send({ type: "restore", state: s });
      setStarted(true);
      setScreen("");
      setTour(null);
      setToast(t("Loaded and paused.", "පූරණය කර නවතා ඇත."));
    } catch {
      setToast(
        t(
          "No compatible Sri Lanka map save. Earlier small-map saves cannot be loaded.",
          "ගැළපෙන ශ්‍රී ලංකා සිතියම් සුරැකුමක් නැත. පැරණි කුඩා සිතියම් සුරැකුම් පූරණය කළ නොහැක.",
        ),
      );
    }
  };
  const asset = state.assets.find((a) => a.id === selected),
    line = state.lines.find((l) => l.id === selected),
    plants = state.assets.filter((a) => !["load", "bus"].includes(a.kind)),
    balance = state.generation - state.demand,
    healthy =
      Math.abs(state.frequency - 50) < 0.5 &&
      state.unserved < state.demand * 0.02,
    progress = state.restoration
      ? 100 * (1 - state.unserved / Math.max(1, state.demand))
      : ((state.time - 28800) / 86400) * 100,
    stars =
      state.outcome === "blackout"
        ? 0
        : state.restoration
          ? state.outcome === "completed"
            ? state.time < 36000
              ? 3
              : state.time < 43200
                ? 2
                : 1
            : 0
          : state.reliability >= 99
            ? 3
            : state.reliability >= 95
              ? 2
              : state.reliability >= 85
                ? 1
                : 0;
  const events = state.events
    .filter((e) => e.level !== "info" && state.time - e.time < 1500)
    .slice(0, 2);
  return (
    <main
      className={`game sri-lanka rts-game ${language === "si" ? "sinhala" : ""} ${state.outcome === "blackout" ? "collapsed" : ""} ${state.weather === "Storm front" ? "storm-weather" : ""}`}
    >
      <div className="world">
        <World
          state={state}
          selected={selected}
          onSelect={choose}
          zoom={zoom}
          reset={reset}
          layer={layer}
          language={language}
          focus={focus}
          onZoom={setZoom}
          controlsEnabled={started && !screen && tour === null}
        />
      </div>
      <div className="world-vignette" />
      <header className="game-top">
        <a className="game-logo" href="/">
          <Zap size={24} fill="currentColor" />
          <span>
            {t("GRIDKEEPER", "විදුලි රැකවලා")}
            <small>SRI LANKA</small>
          </span>
        </a>
        <div className="resources">
          <button
            onClick={() =>
              windows.economy ? closeWindow("economy") : openWindow("economy")
            }
            title={t("Economy and environment", "ආර්ථිකය හා පරිසරය")}
          >
            <Coins size={16} />
            <b>
              {(state.money / 1e6).toFixed(1)}
              <small>{t("Rs M", "රු. මි.")}</small>
            </b>
          </button>
          <div
            title={
              state.restoration
                ? t("Demand restored", "යථා තත්ත්වයට පත් ඉල්ලුම")
                : t("Supply reliability", "සැපයුම් විශ්වසනීයත්වය")
            }
          >
            <span className="resource-heart">♥</span>
            <b>
              {(state.restoration ? progress : state.reliability).toFixed(1)}
              <small>%</small>
            </b>
          </div>
          <button onClick={() => setPanel("economy")}>
            <Leaf size={16} />
            <b>
              {number(state.emissions)}
              <small>t CO₂</small>
            </b>
          </button>
        </div>
        <div className="top-actions">
          <button
            className="language-switch"
            onClick={() => setLanguage(language === "en" ? "si" : "en")}
            aria-label="Switch language / භාෂාව මාරු කරන්න"
          >
            {language === "en" ? "සිංහල" : "English"}
          </button>
          <button
            title={t("Toggle sound", "ශබ්දය මාරු කරන්න")}
            onClick={() => {
              audio.current?.unlock();
              setSound(!sound);
            }}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            title={t("How to play", "ක්‍රීඩා කරන ආකාරය")}
            onClick={() => open("guide")}
          >
            <BookOpen size={18} />
          </button>
          <button
            title={t("Settings", "සැකසුම්")}
            onClick={() => open("settings")}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>
      {windows.restoration && (
        <GameWindow {...win("restoration")}>
          <Restoration
            state={state}
            language={language}
            send={send}
            locate={choose}
          />
        </GameWindow>
      )}
      {windows.mission && (
        <GameWindow {...win("mission")}>
          <section className="mission-card">
            <div className="chapter">
              <span>LK</span>
              {language === "si"
                ? SCENARIOS.find((m) => m.id === state.scenario)?.nameSi
                : SCENARIOS.find((m) => m.id === state.scenario)?.name}
            </div>
            <h1>{t("An island depends on you.", "රටක් ඔබ මත රඳා පවතී.")}</h1>
            <p>
              {t(
                "9 power plants · 10 communities · 18 routes",
                "බලාගාර 9 · ජනාවාස 10 · මාර්ග 18",
              )}
            </p>
            <div className="mission-rule">
              <Flag size={13} />
              <span>
                {state.restoration
                  ? t(
                      "Restore all communities within 24 hours",
                      "පැය 24 තුළ සියලු ජනාවාස යළි සම්බන්ධ කරන්න",
                    )
                  : t(
                      "Complete the 24-hour shift",
                      "පැය 24 මුරය සම්පූර්ණ කරන්න",
                    )}
              </span>
              <b>{number(progress)}%</b>
            </div>
            <div className="mission-progress">
              <i style={{ width: `${progress}%` }} />
            </div>
            {state.restoration ? (
              <button
                className="game-button"
                onClick={() => openWindow("restoration")}
              >
                {t(
                  "Open restoration checklist",
                  "ප්‍රතිස්ථාපන පියවර විවෘත කරන්න",
                )}
              </button>
            ) : (
              <div className="mission-stars">
                {[85, 95, 99].map((v) => (
                  <span
                    key={v}
                    className={state.reliability >= v ? "earned" : ""}
                  >
                    <Star
                      size={12}
                      fill={state.reliability >= v ? "currentColor" : "none"}
                    />
                    {v}%
                  </span>
                ))}
              </div>
            )}
            <div className="mission-actions">
              <button
                className={windows.curves ? "active" : ""}
                onClick={() =>
                  windows.curves ? closeWindow("curves") : openWindow("curves")
                }
              >
                <TrendingUp size={15} />
                {t("Supply & demand", "සැපයුම හා ඉල්ලුම")}
              </button>
              <button
                className={windows.economy ? "active" : ""}
                onClick={() =>
                  windows.economy
                    ? closeWindow("economy")
                    : openWindow("economy")
                }
              >
                <Leaf size={15} />
                {t("Resources & economy", "සම්පත් හා ආර්ථිකය")}
              </button>
            </div>
          </section>
        </GameWindow>
      )}
      {windows.grid && (
        <GameWindow {...win("grid")}>
          <section className="balance-hud">
            <div className="balance-heading">
              <span
                className={healthy ? "status-light" : "status-light danger"}
              />
              {state.restoration && !state.finished
                ? state.frequency === 0
                  ? t("GRID DE-ENERGIZED", "ජාලය අක්‍රියයි")
                  : t(
                      "RESTORATION IN PROGRESS",
                      "සැපයුම යථා තත්ත්වයට පත් කරමින්",
                    )
                : state.finished
                  ? t("SHIFT ENDED", "මුරය අවසන්")
                  : healthy
                    ? t("GRID STABLE", "ජාලය ස්ථාවරයි")
                    : t("GRID AT RISK", "ජාලය අවදානමේ")}
              <b>
                {state.frequency.toFixed(2)} <small>Hz</small>
              </b>
            </div>
            <div className="power-comparison">
              <span>
                <Zap size={12} />
                <b>{number(state.generation)}</b>
                {t("supply", "සැපයුම")}
              </span>
              <span>
                <b>{number(state.demand)}</b>
                {t("demand", "ඉල්ලුම")}
              </span>
            </div>
            <div className="balance-meter">
              <div />
              <i
                style={{
                  left: `${Math.max(3, Math.min(97, 50 + (state.frequency - 50) * 14))}%`,
                }}
              />
            </div>
            <div className="balance-tip">
              {state.restoration && state.frequency === 0
                ? t(
                    "Establish auxiliaries, then start Upper Kotmale from the restoration checklist.",
                    "ප්‍රතිස්ථාපන පියවර අනුව සහායක බලය සපයා ඉහළ කොත්මලේ අරඹන්න.",
                  )
                : state.frequency > 50.5
                  ? t(
                      "High frequency: reduce generation or charge storage.",
                      "සංඛ්‍යාතය ඉහළයි: ජනනය අඩු කරන්න හෝ බැටරි ආරෝපණය කරන්න.",
                    )
                  : state.frequency < 49.5
                    ? t(
                        "Low frequency: increase supply or shed demand.",
                        "සංඛ්‍යාතය අඩුයි: සැපයුම වැඩි කරන්න හෝ බර අඩු කරන්න.",
                      )
                    : t(
                        "Target 50 Hz · keep supply close to demand.",
                        "ඉලක්කය 50 Hz · සැපයුම හා ඉල්ලුම සමතුලිත කරන්න.",
                      )}
            </div>
          </section>
        </GameWindow>
      )}
      {started &&
        !screen &&
        !state.finished &&
        tour === null &&
        state.paused && (
          <div className="paused-ribbon">
            <Pause size={14} />
            {t("PAUSED", "නවතා ඇත")}
            <button onClick={() => send({ type: "pause" })}>
              {t("Resume", "යළි අරඹන්න")}
              <Play size={12} />
            </button>
          </div>
        )}
      {started && !screen && tour === null && !state.finished && (
        <div className="protection-alerts">
          {(state.blackoutTimer > 0 || state.frequencyFailureTimer > 0) && (
            <strong>
              {t(
                "COLLAPSE RISK · act now",
                "බිඳවැටීමේ අවදානම · දැන් ක්‍රියා කරන්න",
              )}{" "}
              {Math.ceil(
                Math.min(
                  state.blackoutTimer > 0
                    ? RELAYS.blackoutDelay - state.blackoutTimer
                    : Infinity,
                  state.frequencyFailureTimer > 0
                    ? RELAYS.frequencyFailureDelay - state.frequencyFailureTimer
                    : Infinity,
                ),
              )}
              s
            </strong>
          )}
          {events.map((e) => (
            <button
              key={e.id}
              className={e.level}
              onClick={() => locateEvent(e)}
            >
              {language === "si" ? e.textSi : e.text}
            </button>
          ))}
        </div>
      )}
      {selected && windows.inspector && started && !screen && (
        <GameWindow {...win("inspector")}>
          <section className="action-card">
            <button
              className="card-close"
              title={t("Close asset", "වත්කම වසන්න")}
              onClick={() => setSelected("")}
            >
              <X size={16} />
            </button>
            <div className="asset-heading">
              <div className={`plant-icon ${asset?.kind ?? "line"}`}>
                <Icon kind={asset?.kind ?? "battery"} />
              </div>
              <div>
                <span className="kicker">
                  {asset
                    ? kindName(asset.kind, language)
                    : t("TRANSMISSION", "සම්ප්‍රේෂණය")}{" "}
                  · {selected}
                </span>
                <h2>
                  {asset
                    ? assetName(asset, language)
                    : `${t("Route", "මාර්ගය")} ${line?.id}`}
                </h2>
              </div>
            </div>
            {asset?.starting ? (
              <p>
                {t("Startup sequence", "ආරම්භක අනුක්‍රමය")}:{" "}
                {Math.ceil(asset.starting)} s
              </p>
            ) : null}
            {state.restoration && asset?.kind === "load" && (
              <p>
                {t("Reconnected", "සම්බන්ධ කළ")}:{" "}
                {Math.round((asset.pickup ?? 0) * 100)}%
              </p>
            )}
            <div className="local-frequency">
              {t("Local frequency", "ප්‍රාදේශීය සංඛ්‍යාතය")}:{" "}
              {state.busFrequency[asset?.bus ?? line?.from ?? 0].toFixed(2)} Hz
            </div>
            <div className="asset-reading">
              <b>
                {number(
                  line
                    ? Math.abs(line.flow)
                    : asset?.kind === "battery"
                      ? state.battery
                      : asset?.kind === "load"
                        ? (asset.served ?? 0)
                        : (asset?.output ?? 0),
                )}
                <small>{asset?.kind === "battery" ? "MWh" : "MW"}</small>
              </b>
              <span className={(asset ?? line)?.online ? "online" : "offline"}>
                {(asset ?? line)?.online
                  ? t("● ONLINE", "● සක්‍රියයි")
                  : t("○ OFFLINE", "○ විසන්ධියි")}
              </span>
            </div>
            {asset && !["load", "bus"].includes(asset.kind) ? (
              <>
                <div className="target-label">
                  <span>
                    {asset.kind === "battery"
                      ? t("Charge ← → Discharge", "ආරෝපණය ← → මුදාහැරීම")
                      : t("Dispatch target", "ජනන ඉලක්කය")}
                  </span>
                  <b>{asset.target.toFixed(0)} MW</b>
                </div>
                <input
                  aria-label={t("Power output target", "ජනන බල ඉලක්කය")}
                  type="range"
                  min={asset.kind === "battery" ? -asset.capacity : 0}
                  max={asset.capacity}
                  step={5}
                  value={asset.target}
                  onChange={(e) =>
                    send({
                      type: "target",
                      id: asset.id,
                      value: +e.target.value,
                    })
                  }
                />
                <div className="slider-ends">
                  <span>
                    {asset.kind === "battery" ? -asset.capacity : 0} MW
                  </span>
                  <span>{asset.capacity} MW</span>
                </div>
                <div className="dispatch-buttons">
                  <button
                    aria-label={t(
                      "Decrease target by 25 MW",
                      "ඉලක්කය MW 25කින් අඩු කරන්න",
                    )}
                    onClick={() =>
                      send({
                        type: "target",
                        id: asset.id,
                        value: asset.target - 25,
                      })
                    }
                  >
                    <Minus size={14} />
                    25 MW
                  </button>
                  <button
                    aria-label={t(
                      "Increase target by 25 MW",
                      "ඉලක්කය MW 25කින් වැඩි කරන්න",
                    )}
                    onClick={() =>
                      send({
                        type: "target",
                        id: asset.id,
                        value: asset.target + 25,
                      })
                    }
                  >
                    <Plus size={14} />
                    25 MW
                  </button>
                </div>
                {asset.kind === "hydro" && (
                  <div className="water-card">
                    <span>
                      <Droplets size={13} />
                      {t("Usable reservoir water", "භාවිත කළ හැකි ජලය")}
                      <b>
                        {((asset.water! / asset.waterMax!) * 100).toFixed(0)}%
                      </b>
                    </span>
                    <progress max={asset.waterMax} value={asset.water} />
                    <small>
                      {asset.water!.toFixed(2)} / {asset.waterMax} Mm³ ·{" "}
                      {t(
                        "Refills with inflow; cannot run empty.",
                        "ජල ගලා ඒමෙන් පිරේ; හිස් වූ විට ජනනය නවතී.",
                      )}
                    </small>
                  </div>
                )}
                <div className="plant-cost">
                  <span>
                    {t("Operating cost", "මෙහෙයුම් වියදම")}
                    <b>
                      {number(TECH[asset.kind].cost)} {t("Rs/MWh", "රු./MWh")}
                    </b>
                  </span>
                  <span>
                    {t("Direct emissions", "සෘජු විමෝචන")}
                    <b>{TECH[asset.kind].emissions} t CO₂/MWh</b>
                  </span>
                </div>
                {(asset.protectionTimer ?? 0) > 0 && (
                  <div className="relay-meter">
                    <span>
                      {t("Frequency relay countdown", "සංඛ්‍යාත ආරක්ෂණ කාලය")}
                      <b>
                        {Math.max(
                          0,
                          RELAYS.generatorDelay - asset.protectionTimer!,
                        ).toFixed(1)}
                        s
                      </b>
                    </span>
                  </div>
                )}
                <button
                  className="secondary-action"
                  disabled={!asset.online && (asset.lockout ?? 0) > 0}
                  onClick={() => send({ type: "toggle", id: asset.id })}
                >
                  {asset.online
                    ? t("Disconnect plant", "බලාගාරය විසන්ධි කරන්න")
                    : (asset.lockout ?? 0) > 0
                      ? `${t("Lockout", "අගුළු කාලය")} ${Math.ceil(asset.lockout!)}s`
                      : t("Restart plant", "බලාගාරය යළි අරඹන්න")}
                  <ChevronRight size={13} />
                </button>
              </>
            ) : line ? (
              <>
                <div className="line-health">
                  <span>{t("Loading / capacity", "බර / ධාරිතාව")}</span>
                  <b>
                    {number((Math.abs(line.flow) / line.capacity) * 100)}% /{" "}
                    {number(line.capacity)} MW
                  </b>
                </div>
                <div className="relay-meter">
                  <span>
                    {t("Thermal relay heat", "තාප ආරක්ෂණ උෂ්ණත්වය")}
                    <b>{number((line.heat / RELAYS.thermalLimit) * 100)}%</b>
                  </span>
                  <progress max={RELAYS.thermalLimit} value={line.heat} />
                  <small>
                    {line.online && Math.abs(line.flow) > line.capacity
                      ? `${t("Trip in", "විසන්ධියට")} ~${secondsToTrip(Math.abs(line.flow) / line.capacity, line.heat).toFixed(1)}s`
                      : t(
                          "Heat cools over time.",
                          "උෂ්ණත්වය කාලයත් සමඟ අඩුවේ.",
                        )}
                  </small>
                </div>
                <button
                  className="game-button full"
                  disabled={!line.online && line.lockout > 0}
                  onClick={() => send({ type: "toggle", id: line.id })}
                >
                  {line.online
                    ? t("Open breaker", "පරිපථය විසන්ධි කරන්න")
                    : line.lockout > 0
                      ? `${t("Lockout", "අගුළු කාලය")} ${Math.ceil(line.lockout)}s`
                      : t("Restore route", "මාර්ගය යළි සම්බන්ධ කරන්න")}
                  <Zap size={14} />
                </button>
                <button
                  className="secondary-action"
                  disabled={state.money < ECONOMY.lineUpgrade}
                  onClick={() => send({ type: "upgrade", id: line.id })}
                >
                  {t("Upgrade +200 MW", "ධාරිතාව +200 MW")}
                  <b>{t("Rs 25M", "රු. මි. 25")}</b>
                </button>
              </>
            ) : asset?.kind === "load" ? (
              <>
                <div className="plant-cost">
                  <span>
                    {t("Requested", "ඉල්ලුම")}
                    <b>{number(asset.output)} MW</b>
                  </span>
                  <span>
                    {t("Actually supplied", "සැබෑ සැපයුම")}
                    <b>{number(asset.served ?? 0)} MW</b>
                  </span>
                  <span>
                    {t("Automatic shedding", "ස්වයංක්‍රීය බර අඩු කිරීම")}
                    <b>{number((asset.autoShed ?? 0) * 100)}%</b>
                  </span>
                </div>
                <p className="asset-help">
                  {t(
                    "Curtailing demand helps low frequency, but makes high frequency worse.",
                    "බර අඩු කිරීම අඩු සංඛ්‍යාතයට උපකාරී වුවද අධි සංඛ්‍යාතය තවත් වැඩි කරයි.",
                  )}
                </p>
                <button
                  className="game-button full"
                  onClick={() => send({ type: "toggle", id: asset.id })}
                >
                  {asset.shed || asset.autoShed
                    ? t("Restore demand", "ඉල්ලුම යළි සපයන්න")
                    : t("Shed 30% demand", "බරෙන් 30%ක් අඩු කරන්න")}
                </button>
              </>
            ) : (
              state.lines
                .filter((l) => l.from === asset?.bus || l.to === asset?.bus)
                .map((l) => (
                  <button
                    className="secondary-action"
                    key={l.id}
                    onClick={() => choose(l.id)}
                  >
                    {l.id} · {number(Math.abs(l.flow))} MW{" "}
                    <ChevronRight size={13} />
                  </button>
                ))
            )}
          </section>
        </GameWindow>
      )}
      {started && !screen && windows.fleet && (
        <GameWindow {...win("fleet")}>
          <Fleet
            state={state}
            language={language}
            selected={selected}
            onSelect={choose}
          />
        </GameWindow>
      )}
      {["curves", "economy", "timeline"]
        .filter((id) => windows[id])
        .map(
          (panel) =>
            started &&
            !screen && (
              <GameWindow key={panel} {...win(panel)}>
                <section
                  className={`field-panel ${panel === "curves" ? "curves-panel" : ""}`}
                >
                  <button
                    className="card-close"
                    aria-label={t("Close panel", "පුවරුව වසන්න")}
                    onClick={() => setPanel("")}
                  >
                    <X size={18} />
                  </button>
                  <h2>
                    {panel === "curves"
                      ? t("Read the next move.", "ඊළඟ පියවර හඳුනාගන්න.")
                      : panel === "economy"
                        ? t(
                            "Every megawatt has a cost.",
                            "සෑම මෙගාවොට් එකකටම වියදමක් ඇත.",
                          )
                        : t("How the grid fell.", "ජාලය බිඳවැටුණු ආකාරය.")}
                  </h2>
                  {panel === "curves" ? (
                    <>
                      <Forecast state={state} language={language} />
                      <button
                        className="secondary-action"
                        onClick={() => send({ type: "plan" })}
                      >
                        {t(
                          "Update forecast from current targets",
                          "වත්මන් ඉලක්කවලින් පුරෝකථනය යාවත්කාලීන කරන්න",
                        )}
                        <TrendingUp size={14} />
                      </button>
                    </>
                  ) : panel === "economy" ? (
                    <>
                      <div className="ledger">
                        {[
                          [
                            t("Energy sales", "විදුලි අලෙවි ආදායම"),
                            state.revenue,
                          ],
                          [
                            t(
                              "Generation operating costs",
                              "ජනන මෙහෙයුම් වියදම",
                            ),
                            -state.fuelCost,
                          ],
                          [
                            t(
                              "Carbon & water-impact levy",
                              "කාබන් හා ජල බලපෑම් ගාස්තුව",
                            ),
                            -state.environmentCost,
                          ],
                          [
                            t(
                              "Unserved-energy penalties",
                              "නොසැපයූ බලශක්ති දඩ",
                            ),
                            -state.outageCost,
                          ],
                          [
                            t("Network investment", "ජාල ආයෝජනය"),
                            -state.upgradeCost,
                          ],
                        ].map(([label, v]) => (
                          <div key={String(label)}>
                            <span>{label}</span>
                            <b className={+v < 0 ? "expense" : ""}>
                              {+v < 0 ? "−" : "+"}
                              {(Math.abs(+v) / 1e6).toFixed(2)}{" "}
                              {t("Rs M", "රු. මි.")}
                            </b>
                          </div>
                        ))}
                      </div>
                      <div className="eco-totals">
                        <span>
                          {t("Direct CO₂", "සෘජු CO₂")}
                          <b>{number(state.emissions)} t</b>
                        </span>
                        <span>
                          {t("Water used", "භාවිත ජලය")}
                          <b>{state.waterUsed.toFixed(2)} Mm³</b>
                        </span>
                        <span>
                          {t("Ecology score", "පාරිසරික ලකුණු")}
                          <b>{number(state.ecology)}/100</b>
                        </span>
                      </div>
                      {state.assets
                        .filter((a) => a.kind === "hydro")
                        .map((a) => (
                          <button
                            className="reservoir-row"
                            key={a.id}
                            onClick={() => choose(a.id)}
                          >
                            <Droplets size={13} />
                            <span>{assetName(a, language)}</span>
                            <b>{number((a.water! / a.waterMax!) * 100)}%</b>
                          </button>
                        ))}
                      <p className="chart-note">
                        {t(
                          "Costs, carbon levy, usable water reserves, and ecology score are gameplay assumptions, not current tariffs or real reservoir readings. Low reservoirs increase ecological cost.",
                          "වියදම්, කාබන් ගාස්තු, භාවිත ජල සංචිත හා පාරිසරික ලකුණු ක්‍රීඩාව සඳහා ගත් අගයන්ය. ඒවා වත්මන් ගාස්තු හෝ සැබෑ ජලාශ දත්ත නොවේ. ජලය අඩුවීම පාරිසරික වියදම වැඩි කරයි.",
                        )}
                      </p>
                    </>
                  ) : (
                    <NotificationLog
                      state={state}
                      language={language}
                      onSelect={locateEvent}
                    />
                  )}
                </section>
              </GameWindow>
            ),
        )}
      <div className="map-tools">
        <select
          className="asset-locator"
          aria-label={t("Locate an asset", "වත්කමක් සොයන්න")}
          value=""
          onChange={(e) => choose(e.target.value)}
        >
          <option value="" disabled>
            ⌖
          </option>
          {state.assets.map((a) => (
            <option key={a.id} value={a.id}>
              {assetName(a, language)}
            </option>
          ))}
          {state.lines.map((l) => (
            <option key={l.id} value={l.id}>
              {t("Route", "මාර්ගය")} {l.id}
            </option>
          ))}
        </select>
        <button
          title={t("Toggle line loading", "රැහැන් බර පෙන්වන්න")}
          onClick={() => setLayer(layer === "flow" ? "loading" : "flow")}
        >
          <Zap size={16} />
        </button>
        <button
          title={t("Zoom in", "විශාල කරන්න")}
          onClick={() => setZoom(Math.min(8, zoom + 0.4))}
        >
          <Plus size={17} />
        </button>
        <button
          title={t("Zoom out", "කුඩා කරන්න")}
          onClick={() => setZoom(Math.max(0.8, zoom - 0.4))}
        >
          <Minus size={17} />
        </button>
        <button
          title={t("Fit island", "මුළු සිතියම")}
          onClick={() => {
            setZoom(1);
            setReset((v) => v + 1);
          }}
        >
          <Maximize size={16} />
        </button>
      </div>
      <footer className="game-bottom">
        <div className="time-controller">
          <div className="game-clock">
            <Sun size={17} />
            <div>
              <b>{gridTime(state.time)}</b>
              <span>
                {state.speed * CLOCK_RATE}{" "}
                {t("grid sec / sec", "ජාල තත් / තත්")}
              </span>
            </div>
          </div>
          <button
            className="play-control"
            disabled={
              !ready || !started || state.finished || !!screen || tour !== null
            }
            title={state.paused ? t("Play", "අරඹන්න") : t("Pause", "නවත්වන්න")}
            onClick={() => send({ type: "pause" })}
          >
            {state.paused ? (
              <Play size={16} fill="currentColor" />
            ) : (
              <Pause size={16} fill="currentColor" />
            )}
          </button>
          <div className="speed-controls">
            {[1, 2, 5, 10, 30].map((v) => (
              <button
                key={v}
                className={state.speed === v ? "active" : ""}
                onClick={() => send({ type: "speed", value: v })}
              >
                {v}×
              </button>
            ))}
          </div>
        </div>
        <nav
          className="command-tray"
          aria-label={t("Command menu", "පාලන මෙනුව")}
        >
          <button
            className={windows.fleet ? "active" : ""}
            onClick={() => openWindow("fleet")}
          >
            <Factory size={18} />
            <span>{t("Fleet", "බලාගාර")}</span>
          </button>
          <button
            className={windows.timeline ? "active" : ""}
            onClick={() => openWindow("timeline")}
          >
            <Bell size={18} />
            <span>{t("Log", "සටහන")}</span>
            {state.events.some((e) => e.level === "critical") && <i />}
          </button>
          <button
            className={windows.curves ? "active" : ""}
            onClick={() => openWindow("curves")}
          >
            <TrendingUp size={18} />
            <span>{t("Curves", "වක්‍ර")}</span>
          </button>
          <button
            className={windows.economy ? "active" : ""}
            onClick={() => openWindow("economy")}
          >
            <Leaf size={18} />
            <span>{t("Economy", "ආර්ථිකය")}</span>
          </button>
          <button
            className={menu ? "active" : ""}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <PanelsTopLeft size={18} />
            <span>{t("Windows", "කවුළු")}</span>
          </button>
        </nav>
      </footer>
      <button
        className="radio-feed"
        onClick={() => {
          const e = state.events[0];
          if (e) locateEvent(e);
          openWindow("timeline");
        }}
      >
        <span className="radio-dot" />
        {gridTime(state.events[0]?.time ?? 28800)} ·{" "}
        {language === "si" ? state.events[0]?.textSi : state.events[0]?.text}
      </button>
      {menu && (
        <nav
          className="windows-menu"
          aria-label={t("Window manager", "කවුළු කළමනාකරු")}
        >
          <header>
            {t("YOUR WORKSPACE", "ඔබේ වැඩබිම")}
            <button
              aria-label={t("Close window menu", "කවුළු මෙනුව වසන්න")}
              onClick={() => setMenu(false)}
            >
              <X size={14} />
            </button>
          </header>
          {[
            "restoration",
            "mission",
            "grid",
            "fleet",
            "inspector",
            "curves",
            "economy",
            "timeline",
          ].map((id) => (
            <button
              key={id}
              onClick={() => {
                if (id === "inspector" && !selected) choose("G1");
                openWindow(id);
                setMenu(false);
              }}
            >
              <span
                className={windows[id] ? "window-dot open" : "window-dot"}
              />
              {titleFor(id)}
              <small>
                {windows[id] ? t("Focus", "ඉදිරියට") : t("Open", "විවෘත")}
              </small>
            </button>
          ))}
          <button
            className="reset-layout"
            onClick={() => {
              setLayout((v) => v + 1);
              setWindows({
                mission: true,
                grid: true,
                fleet: true,
                inspector: true,
              });
              setMenu(false);
            }}
          >
            <RotateCcw size={13} />
            {t("Reset window layout", "කවුළු පිහිටීම යළි සකසන්න")}
          </button>
        </nav>
      )}
      {selected && started && !screen && (
        <div className="map-selection-banner">
          <Crosshair size={15} />
          <span>
            {selected} ·{" "}
            {asset
              ? assetName(asset, language)
              : t("Transmission route", "සම්ප්‍රේෂණ මාර්ගය")}
          </span>
          <button onClick={() => choose(selected)}>
            {t("Locate", "සොයන්න")}
          </button>
          <button
            aria-label={t("Clear map selection", "සිතියම් තේරීම ඉවත් කරන්න")}
            onClick={() => setSelected("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <span className="keyboard-tip">
        {t(
          "WASD / arrows · drag to pan · wheel to zoom · Home to fit",
          "WASD / ඊතල: කැමරාව · ඇදීම: ගමන් · රෝදය: විශාලනය · Home: මුළු සිතියම",
        )}
      </span>
      {state.outcome === "blackout" && (
        <>
          <div className="collapse-shade" />
          <div className="blackout-ending" role="status">
            <span>{t("THE ISLAND WENT DARK", "රට අඳුරට ගිලුණි")}</span>
            <h2>
              {language === "si" ? state.failureCauseSi : state.failureCause}
            </h2>
            <p>
              {t(
                "Watch the routes go dark. Your last decisions are still on the map.",
                "රැහැන් අඳුරු වන අයුරු බලන්න. ඔබේ අවසන් තීරණ සිතියමේ පවතී.",
              )}
            </p>
            <div>
              <button
                className="game-button"
                onClick={() =>
                  windows.timeline
                    ? closeWindow("timeline")
                    : openWindow("timeline")
                }
              >
                {t("Trace the cascade", "බිඳවැටීමේ දාමය බලන්න")}
              </button>
              <button
                className="ending-retry"
                onClick={() => {
                  setScreen("briefing");
                  setStarted(false);
                }}
              >
                <RotateCcw size={16} />
                {t("Try another shift", "තවත් මුරයක් අරඹන්න")}
              </button>
            </div>
          </div>
        </>
      )}
      {state.outcome === "completed" && !screen && (
        <div className="blackout-ending complete-ending">
          <span>
            {state.restoration
              ? t("ISLAND RESTORED", "දිවයිනේ සැපයුම යථා තත්ත්වයට")
              : t("SHIFT COMPLETE", "මුරය අවසන්")}
          </span>
          <div className="result-stars">
            {[1, 2, 3].map((v) => (
              <Star key={v} fill={v <= stars ? "currentColor" : "none"} />
            ))}
          </div>
          <h2>
            {t(
              "You kept the country moving.",
              "ඔබ රටේ ක්‍රියාකාරිත්වය රැකගත්තා.",
            )}
          </h2>
          <p>
            {state.reliability.toFixed(2)}% {t("reliability", "විශ්වසනීයත්වය")}{" "}
            · {number(state.emissions)} t CO₂
          </p>
          <button
            className="game-button"
            onClick={() => {
              setScreen("briefing");
              setStarted(false);
            }}
          >
            {t("Another shift", "තවත් මුරයක්")}
          </button>
        </div>
      )}
      {tour !== null && !screen && !state.finished && (
        <GuidedTour
          language={language}
          step={tour}
          onStep={tourStep}
          onFinish={finishTour}
          selected={selected}
          changed={
            state.assets.find((a) => a.id === "G2")!.target !== tourTarget
          }
        />
      )}
      {toast && (
        <div className="game-toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      {screen && (
        <div
          className={`overlay ${screen === "briefing" ? "intro-overlay" : ""}`}
        >
          <section
            className={`game-dialog ${screen === "briefing" ? "briefing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={t("Game menu", "ක්‍රීඩා මෙනුව")}
          >
            <button
              className="intro-language language-switch"
              onClick={() => setLanguage(language === "en" ? "si" : "en")}
            >
              {language === "en" ? "සිංහල" : "English"}
            </button>
            {screen === "briefing" ? (
              <>
                <div className="mission-number">
                  <Zap size={21} fill="currentColor" />
                  {t(
                    "SRI LANKA · POWER GRID STRATEGY",
                    "ශ්‍රී ලංකාව · විදුලි ජාල උපාය ක්‍රීඩාව",
                  )}
                </div>
                <h2>
                  {t("One country.", "එක රටක්.")}
                  <br />
                  {t("Every connection counts.", "සෑම සබැඳියක්ම වැදගත්.")}
                </h2>
                <p>
                  {t(
                    "From Mannar’s wind to the central reservoirs. Keep a larger, living island powered—without draining its resources.",
                    "මන්නාරමේ සුළං බලයේ සිට මධ්‍යම කඳුකර ජලාශ දක්වා. සම්පත් විනාශ නොකර රටට විදුලිය සපයන්න.",
                  )}
                </p>
                <label className="mission-picker">
                  {t("MISSION", "මෙහෙයුම")}
                  <select
                    aria-label={t("Mission scenario", "මෙහෙයුම් අවස්ථාව")}
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value as ScenarioId)}
                  >
                    {SCENARIOS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {language === "si" ? m.nameSi : m.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    {language === "si"
                      ? SCENARIOS.find((m) => m.id === scenario)?.descriptionSi
                      : SCENARIOS.find((m) => m.id === scenario)?.description}
                  </small>
                </label>
                <div className="brief-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={showTour}
                      onChange={(e) => {
                        setShowTour(e.target.checked);
                        if (e.target.checked)
                          try {
                            localStorage.removeItem("grid-tour-v2");
                          } catch {}
                      }}
                    />
                    {t("Guided tour", "මඟපෙන්වන පුහුණුව")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={sound}
                      onChange={(e) => setSound(e.target.checked)}
                    />
                    {t("Sound on", "ශබ්දය සක්‍රියයි")}
                  </label>
                </div>
                <div className="difficulty-picker">
                  {["easy", "normal", "expert"].map((d) => (
                    <button
                      key={d}
                      className={difficulty === d ? "selected" : ""}
                      onClick={() => setDifficulty(d)}
                    >
                      {d === "easy"
                        ? t("Relaxed", "පහසු")
                        : d === "normal"
                          ? t("Standard", "සාමාන්‍ය")
                          : t("Expert", "ප්‍රවීණ")}
                    </button>
                  ))}
                </div>
                <button
                  className="game-button begin"
                  disabled={!ready}
                  onClick={begin}
                >
                  {t("Take the controls", "පාලනය භාරගන්න")}
                  <ArrowUpRight size={18} />
                </button>
                {saved && (
                  <button className="continue-game" onClick={load}>
                    {t(
                      "Continue saved mission",
                      "සුරැකි මෙහෙයුම පවත්වාගෙන යන්න",
                    )}
                    <ChevronRight size={13} />
                  </button>
                )}
                <button
                  className="continue-game"
                  onClick={() => setScreen("research")}
                >
                  {t("Research & model notes", "පර්යේෂණ හා ආකෘති සටහන්")}
                  <BookOpen size={13} />
                </button>
                <div className="brief-note">
                  {t(
                    "Real plant references. Fictional transmission routes and game-tuned economics.",
                    "සැබෑ බලාගාර ආශ්‍රිතය. සම්ප්‍රේෂණ මාර්ග හා ආර්ථික අගයන් ක්‍රීඩාව සඳහා සකසා ඇත.",
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  className="dialog-close"
                  title={t("Close menu", "මෙනුව වසන්න")}
                  onClick={() => setScreen(started ? "" : "briefing")}
                >
                  <X size={19} />
                </button>
                <span className="dialog-kicker">
                  {t("GRIDKEEPER · FIELD MANUAL", "විදුලි රැකවලා · අත්පොත")}
                </span>
                <h2>
                  {screen === "settings"
                    ? t("Take a breather.", "මඳ විවේකයක් ගන්න.")
                    : screen === "research"
                      ? t("Built on research.", "පර්යේෂණ මත ගොඩනැඟුණි.")
                      : screen === "restart"
                        ? t("A new beginning.", "නව ආරම්භයක්.")
                        : t("Learn the island.", "විදුලි ජාලය හඳුනාගන්න.")}
                </h2>
                {screen === "settings" ? (
                  <>
                    <label className="sound-setting">
                      <input
                        type="checkbox"
                        checked={sound}
                        onChange={(e) => {
                          audio.current?.unlock();
                          setSound(e.target.checked);
                        }}
                      />
                      {t("Game sounds", "ක්‍රීඩා ශබ්ද")}
                    </label>
                    <label className="sound-setting">
                      {t("Volume", "ශබ්ද මට්ටම")} {number(volume * 100)}%
                      <input
                        aria-label={t("Sound volume", "ශබ්ද මට්ටම")}
                        type="range"
                        min="0"
                        max="1"
                        step=".05"
                        value={volume}
                        onChange={(e) => setVolume(+e.target.value)}
                      />
                    </label>
                    <button
                      className="menu-option"
                      onClick={() => {
                        openWindow("grid");
                        openWindow("fleet");
                        setScreen("");
                        setTourTarget(
                          state.assets.find((a) => a.id === "G2")!.target,
                        );
                        setTour(0);
                      }}
                    >
                      <BookOpen size={16} />
                      {t("Replay guided tour", "පුහුණුව නැවත බලන්න")}
                    </button>
                    <button className="menu-option" onClick={save}>
                      <Save size={16} />
                      {t("Save progress", "ප්‍රගතිය සුරකින්න")}
                    </button>
                    <button className="menu-option" onClick={load}>
                      <RotateCcw size={16} />
                      {t("Load saved mission", "සුරැකි මෙහෙයුම පූරණය කරන්න")}
                    </button>
                    <button
                      className="menu-option"
                      onClick={() => setScreen("restart")}
                    >
                      <Flag size={16} />
                      {t("Restart mission", "මෙහෙයුම නැවත අරඹන්න")}
                    </button>
                    <button
                      className="menu-option"
                      onClick={() => setScreen("research")}
                    >
                      <BookOpen size={16} />
                      {t("Research notes", "පර්යේෂණ සටහන්")}
                    </button>
                    <button
                      className="game-button full"
                      onClick={() => setScreen("")}
                    >
                      {t("Back to the island", "සිතියමට යන්න")}
                    </button>
                  </>
                ) : screen === "restart" ? (
                  <>
                    <p>
                      {t(
                        "Start a new mission? Your saved progress stays available.",
                        "නව මෙහෙයුමක් අරඹන්නද? සුරැකි ප්‍රගතිය තවමත් පවතී.",
                      )}
                    </p>
                    <button
                      className="game-button full"
                      onClick={() => {
                        setStarted(false);
                        setScreen("briefing");
                      }}
                    >
                      {t("Choose a mission", "මෙහෙයුමක් තෝරන්න")}
                    </button>
                  </>
                ) : screen === "research" ? (
                  <div className="research-notes">
                    <p>
                      {t(
                        "Plant names and reference capacities come from CEB publications. Sinhala names follow CEB’s Sinhala gallery. This is a strategy game, not an operational replica of the national grid.",
                        "බලාගාර නාම හා යොමු ධාරිතා ලංවිම ප්‍රකාශන ඇසුරෙනි. සිංහල නම් ලංවිම සිංහල ගැලරිය අනුව යොදා ඇත. මෙය උපාය ක්‍රීඩාවක් මිස සැබෑ ජාතික ජාලයේ මෙහෙයුම් පිටපතක් නොවේ.",
                      )}
                    </p>
                    <ul>
                      <li>
                        <a
                          href="https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "Natural Earth · Geographic coastline (public domain)",
                            "Natural Earth · භූගෝලීය වෙරළ සීමාව (පොදු භාවිත දත්ත)",
                          )}
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.ceb.lk/front_img/img_reports/1727249440Sales_and_Generation_Data_Book_2023.pdf"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "CEB · Plant capacities, 2023",
                            "ලංවිම · බලාගාර ධාරිතා, 2023",
                          )}
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.ceb.lk/media-gallery/our-power-plants/si"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "CEB · Sinhala plant names",
                            "ලංවිම · සිංහල බලාගාර නම්",
                          )}
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.pucsl.gov.lk/legal_documents/grid-code/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "PUCSL · Sri Lanka Grid Code",
                            "මහජන උපයෝගිතා කොමිසම · ජාල සංග්‍රහය",
                          )}
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.energy.gov.lk/en/renewable-energy/technologies/hydroelectric-energy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "SLSEA · Hydropower and reservoirs",
                            "සුනිත්‍ය බලශක්ති අධිකාරිය · ජල විදුලිය",
                          )}
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://research-hub.nlr.gov/en/publications/inertia-and-the-power-grid-a-guide-without-the-spin/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t(
                            "NREL · Grid inertia and frequency",
                            "NREL · ජාල අවස්ථිතිය හා සංඛ්‍යාතය",
                          )}
                        </a>
                      </li>
                    </ul>
                    <p>
                      {t(
                        "50 Hz nominal; ±1% normal band. 47.5–52.5 Hz emergency envelope is informed by the 2014 Grid Code. Our trip delays, reservoirs, inflows, prices, carbon levy, demand, solar clusters, battery, and routes are deliberately game-tuned. Emissions track direct operation, not full life-cycle impacts.",
                        "නාමික සංඛ්‍යාතය 50 Hz; සාමාන්‍ය සීමාව ±1%කි. හදිසි සීමාව 47.5–52.5 Hz ලෙස 2014 ජාල සංග්‍රහය ඇසුරෙන් යොදා ඇත. ප්‍රමාද, ජල සංචිත, මිල, කාබන් ගාස්තු, ඉල්ලුම, සූර්ය එකතු, බැටරි හා මාර්ග ක්‍රීඩාවට ගැළපෙන අගයන්ය. විමෝචන සෘජු මෙහෙයුම් සඳහා පමණි.",
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    <ol className="how-to">
                      <li>
                        <b>
                          {t(
                            "Balance both directions.",
                            "දෙපසම සමතුලිත කරන්න.",
                          )}
                        </b>{" "}
                        {t(
                          "Low frequency needs more power. High frequency needs less power or battery charging.",
                          "අඩු සංඛ්‍යාතයට වැඩි ජනනය අවශ්‍යයි. අධි සංඛ්‍යාතයට ජනනය අඩු කිරීම හෝ බැටරි ආරෝපණය අවශ්‍යයි.",
                        )}
                      </li>
                      <li>
                        <b>{t("Save water.", "ජලය සුරකින්න.")}</b>{" "}
                        {t(
                          "Hydro is cheap but reservoirs empty. Thermal backup costs money and emits CO₂.",
                          "ජල විදුලිය ලාභදායී වුවත් ජලාශ හිස් වේ. තාප ජනනයට වැඩි වියදමක් හා CO₂ විමෝචන ඇත.",
                        )}
                      </li>
                      <li>
                        <b>{t("Read the curves.", "වක්‍ර කියවන්න.")}</b>{" "}
                        {t(
                          "Compare measured supply and demand against the saved forecast. Update your dispatch plan when targets change.",
                          "සැබෑ සැපයුම හා ඉල්ලුම පුරෝකථනය සමඟ සසඳන්න. ඉලක්ක වෙනස් කළ පසු සැලසුම යාවත්කාලීන කරන්න.",
                        )}
                      </li>
                      <li>
                        <b>{t("Stop a cascade.", "දාම බිඳවැටීම නවත්වන්න.")}</b>{" "}
                        {t(
                          "Inspect hot lines, buy capacity, and restore circuits after lockouts. Pause to plan.",
                          "අධිබර රැහැන් පරීක්ෂා කර ධාරිතාව වැඩි කරන්න. අගුළු කාලයෙන් පසු නැවත සම්බන්ධ කරන්න. සැලසුම් කිරීමට කාලය නවත්වන්න.",
                        )}
                      </li>
                    </ol>
                    <button
                      className="game-button full"
                      onClick={() => setScreen("")}
                    >
                      {t("Back to the grid", "ජාලයට යන්න")}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
