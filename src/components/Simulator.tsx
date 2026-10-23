"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Droplets,
  Factory,
  Gauge,
  Layers,
  Map as MapIcon,
  Menu,
  Moon,
  Sun,
  Network,
  Pause,
  Play,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  createState,
  validSave,
  CLOCK_RATE,
  type State,
  type Command,
  type Asset,
} from "@/game/engine";
import { SCENARIOS, type ScenarioId } from "@/game/protection";
import { GameAudio } from "@/game/audio";
import { TECH } from "@/game/network";
import { assetName, gridTime, translate, type Language } from "@/game/i18n";
import { sites, transmissionRoutes } from "@/simulator/infrastructure";
import Forecast from "./Forecast";
import Restoration from "./Restoration";
const MapView = dynamic(() => import("./SimulatorMap"), {
  ssr: false,
  loading: () => (
    <div className="sim-map-loading">Loading geographic workspace…</div>
  ),
});
const number = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });
type Section =
  | "overview"
  | "assets"
  | "network"
  | "analytics"
  | "events"
  | "restoration"
  | "sources";
const SAVE_KEY = "lanka-grid-simulator-v1";
export default function Simulator() {
  const [state, setState] = useState<State>(() => createState()),
    [ready, setReady] = useState(false),
    [language, setLanguage] = useState<Language>("en"),
    [theme, setTheme] = useState<"dark" | "light">("dark"),
    [section, setSection] = useState<Section>("overview"),
    [selectedId, setSelectedId] = useState(""),
    [focusId, setFocusId] = useState<string | null>(null),
    [focusRequest, setFocusRequest] = useState(0),
    [mapSession, setMapSession] = useState(0),
    [layer, setLayer] = useState<"operations" | "infrastructure">(
      "infrastructure",
    ),
    [showLabels, setShowLabels] = useState(true),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [chartOpen, setChartOpen] = useState(false),
    [panelOpen, setPanelOpen] = useState(true),
    [settings, setSettings] = useState(false),
    [scenario, setScenario] = useState<ScenarioId>("first-shift"),
    [toast, setToast] = useState(""),
    [help, setHelp] = useState(false),
    [severity, setSeverity] = useState("all"),
    [sound, setSound] = useState(false),
    [saveAvailable, setSaveAvailable] = useState(false);
  const worker = useRef<Worker | null>(null),
    audio = useRef<GameAudio | null>(null),
    heardEvent = useRef<number | null>(null),
    quietSnapshot = useRef<{
      scenario: ScenarioId;
      time: number;
      eventId: number;
    } | null>(null),
    snapshot = useRef(state);
  snapshot.current = state;
  const t = translate(language);
  useEffect(() => {
    audio.current = new GameAudio();
    audio.current.configure(false, 0.18);
    if (window.matchMedia("(max-width: 760px)").matches) setPanelOpen(false);
    const w = new Worker(
      new URL("../game/simulation.worker.ts", import.meta.url),
    );
    worker.current = w;
    w.onmessage = (e: MessageEvent<State>) => {
      setState(e.data);
      setReady(true);
      const newest = e.data.events[0]?.id ?? 0;
      if (quietSnapshot.current) {
        const expected = quietSnapshot.current;
        if (
          e.data.paused &&
          e.data.scenario === expected.scenario &&
          e.data.time === expected.time &&
          newest === expected.eventId
        ) {
          quietSnapshot.current = null;
          setMapSession((session) => session + 1);
          heardEvent.current = newest;
        }
        return;
      }
      if (heardEvent.current !== null && newest >= heardEvent.current) {
        const fresh = e.data.events.filter(
          (event) => event.id > heardEvent.current!,
        );
        if (fresh.some((event) => event.level === "critical"))
          audio.current?.play("trip");
        else if (fresh.some((event) => event.level === "warning"))
          audio.current?.play("warning");
      }
      heardEvent.current = newest;
    };
    w.onerror = () =>
      setToast("Simulation worker could not start. Reload the page to retry.");
    try {
      setSaveAvailable(!!localStorage.getItem(SAVE_KEY));
      const savedTheme = localStorage.getItem("lanka-sim-theme");
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      const l = localStorage.getItem("lanka-sim-language");
      if (l === "si") setLanguage(l);
    } catch {}
    return () => {
      w.terminate();
      worker.current = null;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!settings && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".sim-modal");
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, input, a[href]",
        ) ?? [],
      );
    elements()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        setHelp(false);
      }
      if (e.key === "Tab") {
        const items = elements(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [settings, help]);
  const send = (c: Command) => {
    if (!worker.current) return;
    if (c.type === "restore")
      quietSnapshot.current = {
        scenario: c.state.scenario,
        time: c.state.time,
        eventId: c.state.events[0]?.id ?? 0,
      };
    else if (c.type === "reset")
      quietSnapshot.current = {
        scenario: c.scenario ?? "first-shift",
        time: 28800,
        eventId: 1,
      };
    else if (!snapshot.current.finished) {
      if (c.type === "toggle") audio.current?.play("breaker");
      else if (c.type === "target" || c.type === "pickup")
        audio.current?.play("dispatch");
    }
    worker.current.postMessage(c);
  };
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    audio.current?.configure(enabled, 0.18);
    if (enabled) {
      audio.current?.unlock();
      audio.current?.play("select");
    }
  }
  function choose(id: string) {
    setSelectedId(id);
    setFocusId(id);
    setFocusRequest((request) => request + 1);
    if (window.matchMedia("(max-width: 760px)").matches) setPanelOpen(false);
    if (id.startsWith("model:")) setLayer("operations");
  }
  function chooseModel(id: string) {
    const site = sites.find((s) => s.simulationId === id);
    choose(site?.id ?? `model:${id}`);
    setLayer("operations");
  }
  function nav(next: Section) {
    setSection(next);
    setPanelOpen(true);
  }
  function changeLanguage() {
    const l = language === "en" ? "si" : "en";
    setLanguage(l);
    try {
      localStorage.setItem("lanka-sim-language", l);
    } catch {}
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot.current));
      setSaveAvailable(true);
      setToast(
        t("Simulation saved on this device.", "මෙම උපාංගයේ සමාකරණය සුරැකුණා."),
      );
    } catch {
      setToast(
        t(
          "Could not save. Device storage may be unavailable.",
          "සුරැකීම අසාර්ථකයි. උපාංග ආචයනය නොමැති විය හැක.",
        ),
      );
    }
  }
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
      if (!validSave(v)) throw Error();
      send({ type: "restore", state: v });
      setScenario(v.scenario);
      setSettings(false);
      setLayer("operations");
      setSelectedId("");
      setFocusId("country");
      setFocusRequest((request) => request + 1);
      setToast(
        t(
          "Saved simulation restored, paused.",
          "සුරැකි සමාකරණය නවතා ඇති තත්ත්වයෙන් පූරණය කළා.",
        ),
      );
      nav(v.restoration ? "restoration" : "overview");
    } catch {
      setToast(
        t(
          "No compatible saved simulation found.",
          "ගැළපෙන සුරැකි සමාකරණයක් නොමැත.",
        ),
      );
    }
  }
  function reset() {
    send({ type: "reset", scenario, difficulty: "normal" });
    setSelectedId("");
    setFocusId("country");
    setFocusRequest((request) => request + 1);
    setSettings(false);
    if (scenario === "black-start") {
      nav("restoration");
      setLayer("operations");
    } else nav("overview");
    setToast(
      t(
        "New scenario ready. Press Run when you are ready.",
        "නව අවස්ථාව සූදානම්. සූදානම් වූ විට අරඹන්න.",
      ),
    );
  }
  const site = sites.find((s) => s.id === selectedId),
    route = transmissionRoutes.find((r) => `route:${r.id}` === selectedId),
    modelId =
      site?.simulationId ??
      (selectedId.startsWith("model:") ? selectedId.slice(6) : ""),
    asset = state.assets.find((a) => a.id === modelId),
    line = state.lines.find((l) => l.id === modelId),
    generators = state.assets.filter((a) => !["bus", "load"].includes(a.kind)),
    served = Math.max(0, state.demand - state.unserved),
    live = state.busFrequency.filter((f) => f > 0),
    stable = live.length > 0 && live.every((f) => f >= 49.5 && f <= 50.5),
    notices = state.events.filter(
      (e) => severity === "all" || e.level === severity,
    ),
    online = generators.filter((a) => a.online).length,
    visibleSites = sites.filter(
      (s) =>
        (filter === "all" ||
          (filter === "substation"
            ? s.kind === "substation"
            : s.kind !== "substation")) &&
        `${s.name} ${s.nameSi} ${s.kind}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    visibleAggregates = state.assets.filter(
      (a) =>
        a.kind !== "bus" &&
        !sites.some((s) => s.simulationId === a.id) &&
        (filter === "all" || (filter === "generation" && a.kind !== "load")) &&
        `${a.name} ${a.nameSi} ${a.kind} ${a.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    );
  const links: [Section, typeof Gauge, string, string][] = [
    ["overview", Gauge, "Overview", "දළ විශ්ලේෂණය"],
    ["assets", Factory, "Asset explorer", "වත්කම් ගවේෂකය"],
    ["network", Network, "Network", "ජාලය"],
    ["analytics", TrendingUp, "Analytics", "විශ්ලේෂණ"],
    ["events", Bell, "Event log", "සිදුවීම් සටහන"],
    ["restoration", Zap, "Restoration", "ප්‍රතිස්ථාපනය"],
    ["sources", BookOpen, "Sources & model", "මූලාශ්‍ර සහ ආකෘතිය"],
  ];
  const title = links.find((l) => l[0] === section)!;
  function assetControls(a: Asset) {
    const loadEnergized = state.busFrequency[a.bus] > 0,
      loadConnected = loadEnergized && (a.pickup ?? 1) > 0,
      loadSupplied = loadConnected && (a.served ?? 0) > 0.01,
      loadPartial =
        loadSupplied &&
        ((a.pickup ?? 1) < 0.99 ||
          !!a.shed ||
          (a.autoShed ?? 0) > 0 ||
          (a.served ?? 0) < a.output * 0.99),
      badgeTone =
        a.kind === "load"
          ? loadSupplied
            ? loadPartial
              ? ""
              : "good"
            : "muted"
          : a.online
            ? "good"
            : "muted";
    return (
      <div className="sim-dispatch">
        <div className="sim-reading">
          <strong>
            {number(a.kind === "load" ? (a.served ?? 0) : a.output, 1)}
            <small> MW</small>
          </strong>
          <span className={`sim-badge ${badgeTone}`}>
            {a.kind === "load"
              ? !loadEnergized
                ? t("DE-ENERGIZED", "බලය නොමැත")
                : !loadConnected
                  ? t("DISCONNECTED", "විසන්ධියි")
                  : !loadSupplied
                    ? t("UNSUPPLIED", "සැපයුම නොමැත")
                    : loadPartial
                      ? t("PARTLY SUPPLIED", "අර්ධ සැපයුම")
                      : t("SUPPLIED", "සැපයුම ඇත")
              : a.starting
                ? t("STARTING", "ආරම්භ වෙමින්")
                : a.online
                  ? t("ONLINE", "සක්‍රියයි")
                  : t("OFFLINE", "අක්‍රියයි")}
          </span>
        </div>
        <dl className="sim-properties">
          <div>
            <dt>{t("Local frequency", "ප්‍රාදේශීය සංඛ්‍යාතය")}</dt>
            <dd>{state.busFrequency[a.bus].toFixed(2)} Hz</dd>
          </div>
          <div>
            <dt>{t("Model bus", "ආකෘති බස්බාරය")}</dt>
            <dd>S{a.bus + 1}</dd>
          </div>
        </dl>
        {a.kind !== "load" && a.kind !== "bus" && (
          <>
            <label className="sim-range-label" htmlFor="dispatch-target">
              {t(
                state.restoration ? "Governor ceiling" : "Dispatch target",
                state.restoration ? "පාලක උපරිමය" : "ජනන ඉලක්කය",
              )}
              <b>{number(a.target)} MW</b>
            </label>
            <input
              id="dispatch-target"
              type="range"
              min={a.kind === "battery" ? -a.capacity : 0}
              max={a.capacity}
              step={1}
              value={a.target}
              disabled={state.finished || !ready}
              onChange={(e) =>
                send({
                  type: "target",
                  id: a.id,
                  value: Number(e.target.value),
                })
              }
            />
            <div className="sim-range-ends">
              <span>{a.kind === "battery" ? -a.capacity : 0} MW</span>
              <span>{a.capacity} MW</span>
            </div>
            <div className="sim-dispatch-steps">
              {[-25, 25].map((v) => (
                <button
                  key={v}
                  disabled={state.finished}
                  onClick={() =>
                    send({ type: "target", id: a.id, value: a.target + v })
                  }
                >
                  {v > 0 ? "+" : ""}
                  {v} MW
                </button>
              ))}
            </div>
            <p className="sim-caption">
              {t(
                "Output ramps toward the target; water, weather and protection can limit generation.",
                "ජලය, කාලගුණය හා ආරක්ෂණය අනුව සීමා වෙමින් ජනනය ඉලක්කයට ළඟා වේ.",
              )}
            </p>
            {a.starting ? (
              <div className="sim-notice">
                {t("Startup sequence", "ආරම්භක අනුක්‍රමය")} ·{" "}
                {Math.ceil(a.starting)} s
              </div>
            ) : null}
            <button
              className={a.online ? "sim-button secondary" : "sim-button"}
              disabled={state.finished || !!a.starting || !!a.lockout}
              onClick={() => send({ type: "toggle", id: a.id })}
            >
              {a.online
                ? t("Disconnect generator", "ජනකය විසන්ධි කරන්න")
                : t("Start generator", "ජනකය අරඹන්න")}
            </button>
            {a.lockout ? (
              <p className="sim-caption">
                {t("Protection lockout", "ආරක්ෂණ අගුල")}: {Math.ceil(a.lockout)}{" "}
                s
              </p>
            ) : null}
          </>
        )}
        {a.kind === "hydro" && (
          <div className="sim-water">
            <div>
              <Droplets size={16} />
              {t("Usable reservoir", "භාවිත කළ හැකි ජලය")}
              <b>{number((100 * a.water!) / a.waterMax!)}%</b>
            </div>
            <progress max={a.waterMax} value={a.water} />
            <span>
              {number(a.water!, 2)} / {a.waterMax} Mm³ ·{" "}
              {t("modeled storage", "ආකෘතිගත ගබඩාව")}
            </span>
          </div>
        )}
        {a.kind === "battery" && (
          <div className="sim-notice">
            {t("Stored energy", "ගබඩා කළ ශක්තිය")}: {number(state.battery, 1)} /
            600 MWh
          </div>
        )}
        {a.kind === "load" && (
          <>
            <div className="sim-notice">
              {t(
                "Regional demand aggregate, not a surveyed consumer connection.",
                "මෙය සමස්ත ප්‍රාදේශීය ඉල්ලුමයි; මිනුම් කළ පාරිභෝගික සම්බන්ධතාවයක් නොවේ.",
              )}
            </div>
            {state.restoration ? (
              <button
                className="sim-button"
                disabled={state.finished}
                onClick={() => nav("restoration")}
              >
                {t(
                  "Open staged restoration",
                  "පියවරෙන් ප්‍රතිස්ථාපනය විවෘත කරන්න",
                )}
              </button>
            ) : (
              <button
                className="sim-button"
                disabled={state.finished}
                onClick={() => send({ type: "toggle", id: a.id })}
              >
                {a.shed || a.autoShed
                  ? t("Restore demand", "ඉල්ලුම යළි සපයන්න")
                  : t("Curtail demand by 30%", "ඉල්ලුම 30%කින් සීමා කරන්න")}
              </button>
            )}
          </>
        )}
      </div>
    );
  }
  return (
    <main className="simulator" data-theme={theme} lang={language}>
      <header className="sim-header">
        <a className="sim-brand" href="/">
          <span>
            <Zap size={21} />
          </span>
          <div>
            LANKA<span>GRID SIMULATOR</span>
          </div>
        </a>
        <div className="sim-workspace-title">
          <span>
            {t("National transmission workspace", "ජාතික සම්ප්‍රේෂණ වැඩබිම")}
          </span>
          <small>
            {t(
              "Sri Lanka · Research edition",
              "ශ්‍රී ලංකාව · පර්යේෂණ සංස්කරණය",
            )}
          </small>
        </div>
        <div className="sim-top-actions">
          <span className="sim-training">
            <i />
            {t("SIMULATED DATA", "සමාකෘති දත්ත")}
          </span>
          <button
            title={t("Save simulation", "සමාකරණය සුරකින්න")}
            onClick={save}
            disabled={!ready}
          >
            <Save size={17} />
            <span>{t("Save", "සුරකින්න")}</span>
          </button>
          <button
            className="sim-theme-toggle"
            aria-label={
              theme === "dark"
                ? t("Switch to light theme", "ආලෝක තේමාවට මාරු වන්න")
                : t("Switch to dark theme", "අඳුරු තේමාවට මාරු වන්න")
            }
            title={
              theme === "dark"
                ? t("Switch to light theme", "ආලෝක තේමාවට මාරු වන්න")
                : t("Switch to dark theme", "අඳුරු තේමාවට මාරු වන්න")
            }
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              try {
                localStorage.setItem("lanka-sim-theme", next);
              } catch {}
            }}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            onClick={changeLanguage}
            aria-label="Switch language / භාෂාව මාරු කරන්න"
          >
            {language === "en" ? "සිංහල" : "English"}
          </button>
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={
              sound
                ? t("Mute simulation sounds", "සමාකරණ ශබ්ද නිහඬ කරන්න")
                : t("Enable simulation sounds", "සමාකරණ ශබ්ද සක්‍රිය කරන්න")
            }
            title={
              sound
                ? t("Mute simulation sounds", "සමාකරණ ශබ්ද නිහඬ කරන්න")
                : t("Enable simulation sounds", "සමාකරණ ශබ්ද සක්‍රිය කරන්න")
            }
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>
              {sound
                ? t("Sound on", "ශබ්ද සක්‍රියයි")
                : t("Sound off", "ශබ්ද නිහඬයි")}
            </span>
          </button>
          <button
            onClick={() => setHelp(true)}
            aria-label={t("Quick guide", "ඉක්මන් මාර්ගෝපදේශය")}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <nav
        className="sim-rail"
        aria-label={t("Workspace navigation", "වැඩබිම් සංචාලනය")}
      >
        {links.map(([id, Icon, en, si]) => (
          <button
            key={id}
            title={t(en, si)}
            aria-label={t(en, si)}
            aria-current={section === id ? "page" : undefined}
            className={section === id && panelOpen ? "active" : ""}
            onClick={() =>
              section === id && panelOpen ? setPanelOpen(false) : nav(id)
            }
          >
            <Icon size={21} />
            {id === "events" &&
              state.events.some((e) => e.level === "critical") && <i />}
          </button>
        ))}
        <a
          href="/classic"
          title={t("Original game", "මුල් ක්‍රීඩාව")}
          aria-label={t("Original game", "මුල් ක්‍රීඩාව")}
        >
          <ArrowUpRight size={20} />
        </a>
      </nav>
      {panelOpen && (
        <aside className="sim-sidebar">
          <div className="sim-panel-heading">
            <div>
              <span className="sim-eyebrow">
                {t("CONTROL CENTER", "පාලන මධ්‍යස්ථානය")}
              </span>
              <h1>{t(title[2], title[3])}</h1>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              aria-label={t("Close sidebar", "පැති පුවරුව වසන්න")}
            >
              <X size={17} />
            </button>
          </div>
          <div className="sim-panel-content">
            {section === "overview" && (
              <>
                <div className="sim-status-card">
                  <div>
                    <i className={stable ? "good" : "warning"} />
                    {state.finished
                      ? t("Scenario ended", "අවස්ථාව අවසන්")
                      : state.restoration
                        ? t(
                            "Restoration in progress",
                            "ප්‍රතිස්ථාපනය සිදුවෙමින්",
                          )
                        : stable
                          ? t("Frequency normal", "සංඛ්‍යාතය සාමාන්‍යයි")
                          : t(
                              "Operator attention",
                              "ක්‍රියාකරුගේ අවධානය අවශ්‍යයි",
                            )}
                  </div>
                  <strong>
                    {state.frequency.toFixed(2)}
                    <small> Hz</small>
                  </strong>
                  <div className="sim-frequency-track">
                    <i
                      style={{
                        left: `${Math.max(2, Math.min(98, 50 + (state.frequency - 50) * 22))}%`,
                      }}
                    />
                  </div>
                  <footer>
                    49.5{" "}
                    <span>
                      {t("NORMAL OPERATING BAND", "සාමාන්‍ය මෙහෙයුම් පරාසය")}
                    </span>{" "}
                    50.5
                  </footer>
                </div>
                <div className="sim-metric-grid">
                  <div>
                    <span>{t("Generation", "ජනනය")}</span>
                    <b>
                      {number(state.generation)}
                      <small> MW</small>
                    </b>
                  </div>
                  <div>
                    <span>{t("Demand", "ඉල්ලුම")}</span>
                    <b>
                      {number(state.demand)}
                      <small> MW</small>
                    </b>
                  </div>
                  <div>
                    <span>{t("Unserved", "නොසැපයූ")}</span>
                    <b className={state.unserved > 20 ? "warning-text" : ""}>
                      {number(state.unserved)}
                      <small> MW</small>
                    </b>
                  </div>
                  <div>
                    <span>{t("Online units", "සක්‍රිය ඒකක")}</span>
                    <b>
                      {online}
                      <small> / {generators.length}</small>
                    </b>
                  </div>
                </div>
                <h2 className="sim-section-title">
                  {t("Generation mix", "ජනන සංයුතිය")}
                </h2>
                <div className="sim-mix-bar">
                  {["coal", "hydro", "oil", "wind", "solar"].map((k) => (
                    <i
                      key={k}
                      className={`type-${k}`}
                      style={{
                        flex: Math.max(
                          0.01,
                          generators
                            .filter((a) => a.kind === k)
                            .reduce((v, a) => v + Math.max(0, a.output), 0),
                        ),
                      }}
                    />
                  ))}
                </div>
                <div className="sim-mix-list">
                  {[
                    ["coal", "Coal", "ගල් අඟුරු"],
                    ["hydro", "Hydro", "ජල"],
                    ["oil", "Thermal / oil", "තාප / තෙල්"],
                    ["wind", "Wind", "සුළං"],
                    ["solar", "Solar", "සූර්ය"],
                  ].map(([k, en, si]) => (
                    <div key={k}>
                      <span>
                        <i className={`type-${k}`} />
                        {t(en, si)}
                      </span>
                      <b>
                        {number(
                          generators
                            .filter((a) => a.kind === k)
                            .reduce((v, a) => v + a.output, 0),
                        )}{" "}
                        MW
                      </b>
                    </div>
                  ))}
                </div>
                <div className="sim-scenario-card">
                  <span className="sim-eyebrow">
                    {t("ACTIVE SCENARIO", "සක්‍රිය අවස්ථාව")}
                  </span>
                  <strong>
                    {language === "si"
                      ? SCENARIOS.find((s) => s.id === state.scenario)?.nameSi
                      : SCENARIOS.find((s) => s.id === state.scenario)?.name}
                  </strong>
                  <p>
                    {language === "si"
                      ? SCENARIOS.find((s) => s.id === state.scenario)
                          ?.descriptionSi
                      : SCENARIOS.find((s) => s.id === state.scenario)
                          ?.description}
                  </p>
                  <button onClick={() => setSettings(true)}>
                    <Settings2 size={15} />
                    {t("Configure scenario", "අවස්ථාව සකසන්න")}
                    <ChevronRight size={15} />
                  </button>
                </div>
                <button
                  className="sim-text-button"
                  onClick={() => setHelp(true)}
                >
                  <CircleHelp size={15} />
                  {t(
                    "New here? A 60-second guide",
                    "නවකයෙක්ද? ඉක්මන් මාර්ගෝපදේශය",
                  )}
                </button>
              </>
            )}
            {section === "assets" && (
              <>
                <label className="sim-search">
                  <Search size={17} />
                  <input
                    placeholder={t(
                      "Search plants or substations…",
                      "බලාගාර හෝ උපපොළ සොයන්න…",
                    )}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="sim-segments">
                  {[
                    ["all", "All", "සියල්ල"],
                    ["generation", "Plants", "බලාගාර"],
                    ["substation", "Substations", "උපපොළ"],
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
                <div className="sim-list-heading">
                  {visibleSites.length}{" "}
                  {t("RESEARCHED LOCATIONS", "පර්යේෂණ කළ ස්ථාන")}
                </div>
                {visibleSites.map((s) => (
                  <button
                    className={`sim-asset-row ${selectedId === s.id ? "selected" : ""}`}
                    key={s.id}
                    onClick={() => choose(s.id)}
                  >
                    <span className={`sim-asset-icon type-${s.kind}`}>
                      {s.kind === "substation" ? (
                        <Network size={17} />
                      ) : (
                        <Factory size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{language === "si" ? s.nameSi : s.name}</strong>
                      <small>
                        {s.capacityMW ? `${s.capacityMW} MW · ` : ""}
                        {s.voltageKV ? `${s.voltageKV} kV · ` : ""}
                        {s.simulationId
                          ? t("Dispatch linked", "ජනනයට සම්බන්ධයි")
                          : t("Reference asset", "යොමු වත්කම")}
                      </small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
                {!visibleSites.length && !visibleAggregates.length && (
                  <p className="sim-empty">
                    {t(
                      "No matching assets. Try another name.",
                      "ගැළපෙන වත්කම් නොමැත. වෙනත් නමක් සොයන්න.",
                    )}
                  </p>
                )}
                {visibleAggregates.length > 0 && (
                  <>
                    <h2 className="sim-section-title">
                      {t("Additional model aggregates", "අමතර ආකෘති ඒකක")}
                    </h2>
                    <p className="sim-caption">
                      {t(
                        "Regional demand, solar clusters and storage are simplified model assets.",
                        "ප්‍රාදේශීය ඉල්ලුම, සූර්ය සමූහ සහ බැටරි සරල ආකෘති වත්කම් වේ.",
                      )}
                    </p>
                    {visibleAggregates.map((a) => (
                      <button
                        key={a.id}
                        className="sim-asset-row"
                        onClick={() => chooseModel(a.id)}
                      >
                        <span className="sim-asset-icon">
                          <Zap size={16} />
                        </span>
                        <span>
                          <strong>{assetName(a, language)}</strong>
                          <small>
                            {a.id} · {t("Simulation aggregate", "සමාකරණ එකතුව")}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
            {section === "network" && (
              <>
                <div className="sim-notice">
                  <ShieldCheck size={18} />
                  <span>
                    {t(
                      "Mapped routes describe geography. Dashed model corridors carry simulated power flows.",
                      "සිතියම්ගත රැහැන් භූගෝලය දක්වයි. ඉරි කඩ සහිත ආකෘති මාර්ග සමාකෘති බල ප්‍රවාහය දක්වයි.",
                    )}
                  </span>
                </div>
                <div className="sim-segments">
                  <button
                    className={layer === "infrastructure" ? "active" : ""}
                    onClick={() => setLayer("infrastructure")}
                  >
                    {t("Mapped routes", "සිතියම්ගත මාර්ග")}
                  </button>
                  <button
                    className={layer === "operations" ? "active" : ""}
                    onClick={() => setLayer("operations")}
                  >
                    {t("Model breakers", "ආකෘති කඩන")}
                  </button>
                </div>
                {layer === "infrastructure" ? (
                  <>
                    <h2 className="sim-section-title">
                      {t("Mapped transmission", "සිතියම්ගත සම්ප්‍රේෂණය")}
                    </h2>
                    <p className="sim-caption">
                      {transmissionRoutes.length}{" "}
                      {t(
                        "route segments · select to inspect provenance",
                        "මාර්ග කොටස් · මූලාශ්‍ර බැලීමට තෝරන්න",
                      )}
                    </p>
                    {transmissionRoutes.map((r) => (
                      <button
                        key={r.id}
                        className="sim-asset-row"
                        onClick={() => {
                          setLayer("infrastructure");
                          choose(`route:${r.id}`);
                        }}
                      >
                        <span className="sim-voltage">
                          {r.voltageKV || "—"}
                          <small>kV</small>
                        </span>
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.confidence === "mapped"
                              ? t("OSM geometry", "OSM ජ්‍යාමිතිය")
                              : t("Approximate route", "ආසන්න මාර්ගය")}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <h2 className="sim-section-title">
                      {t("Simulation corridors", "සමාකරණ මාර්ග")}
                    </h2>
                    {state.lines.map((l) => (
                      <button
                        key={l.id}
                        className="sim-asset-row"
                        onClick={() => choose(`model:${l.id}`)}
                      >
                        <span
                          className={`sim-line-state ${!l.online ? "off" : Math.abs(l.flow) > l.capacity ? "over" : ""}`}
                        />
                        <span>
                          <strong>
                            {l.id} · S{l.from + 1} — S{l.to + 1}
                          </strong>
                          <small>
                            {!l.online
                              ? t("Breaker open", "කඩනය විවෘතයි")
                              : `${number(Math.abs(l.flow))} / ${l.capacity} MW`}
                          </small>
                        </span>
                        <b>
                          {l.online
                            ? `${number((100 * Math.abs(l.flow)) / l.capacity)}%`
                            : "—"}
                        </b>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
            {section === "analytics" && (
              <>
                <div className="sim-notice">
                  <Activity size={18} />
                  <span>
                    {t(
                      "Telemetry comes from the running simulation, not CEB live data.",
                      "දත්ත ක්‍රියාත්මක සමාකරණයෙන් ලැබේ; ලංවිම සජීවී දත්ත නොවේ.",
                    )}
                  </span>
                </div>
                <h2 className="sim-section-title">
                  {t("Energy & resources", "ශක්තිය හා සම්පත්")}
                </h2>
                <dl className="sim-properties large">
                  <div>
                    <dt>{t("Demand served", "සැපයූ ඉල්ලුම")}</dt>
                    <dd>{number(served)} MW</dd>
                  </div>
                  <div>
                    <dt>{t("Supply reliability", "සැපයුම් විශ්වසනීයත්වය")}</dt>
                    <dd>{number(state.reliability, 1)}%</dd>
                  </div>
                  <div>
                    <dt>{t("Stored energy", "ගබඩා ශක්තිය")}</dt>
                    <dd>{number(state.battery)} MWh</dd>
                  </div>
                  <div>
                    <dt>{t("Water used", "භාවිත ජලය")}</dt>
                    <dd>{number(state.waterUsed, 3)} Mm³</dd>
                  </div>
                  <div>
                    <dt>{t("Direct emissions", "සෘජු විමෝචන")}</dt>
                    <dd>{number(state.emissions, 1)} t CO₂</dd>
                  </div>
                </dl>
                <h2 className="sim-section-title">
                  {t("Illustrative economic ledger", "නිදර්ශන ආර්ථික ලේඛනය")}
                </h2>
                <dl className="sim-properties large">
                  {[
                    [t("Balance", "ශේෂය"), state.money],
                    [t("Sales revenue", "විකුණුම් ආදායම"), state.revenue],
                    [
                      t("Fuel & operating cost", "ඉන්ධන හා මෙහෙයුම් වියදම"),
                      state.fuelCost,
                    ],
                    [
                      t("Environmental cost", "පාරිසරික වියදම"),
                      state.environmentCost,
                    ],
                    [
                      t("Unserved energy penalty", "නොසැපයූ ශක්ති දඩය"),
                      state.outageCost,
                    ],
                  ].map(([label, v]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>Rs {number(Number(v) / 1e6, 2)} M</dd>
                    </div>
                  ))}
                </dl>
                <p className="sim-caption">
                  {t(
                    "Tariffs, carbon prices, reservoir volumes and dispatch limits are model assumptions, not current utility operating data.",
                    "ගාස්තු, කාබන් මිල, ජලාශ පරිමා හා ජනන සීමා ආකෘති උපකල්පන වේ; වත්මන් විදුලි දත්ත නොවේ.",
                  )}
                </p>
                <button
                  className="sim-button"
                  onClick={() => setChartOpen(true)}
                >
                  <TrendingUp size={16} />
                  {t(
                    "Show supply & demand curves",
                    "සැපයුම් හා ඉල්ලුම් වක්‍ර පෙන්වන්න",
                  )}
                </button>
              </>
            )}
            {section === "events" && (
              <>
                <div className="sim-segments">
                  {[
                    ["all", "All", "සියල්ල"],
                    ["warning", "Warnings", "අනතුරු"],
                    ["critical", "Critical", "බරපතළ"],
                  ].map(([v, en, si]) => (
                    <button
                      key={v}
                      className={severity === v ? "active" : ""}
                      onClick={() => setSeverity(v)}
                    >
                      {t(en, si)}
                    </button>
                  ))}
                </div>
                <p className="sim-caption">
                  {t(
                    "Select an event to locate its equipment. Latest 100 events are retained.",
                    "උපකරණය සොයා ගැනීමට සිදුවීමක් තෝරන්න. නවතම සිදුවීම් 100 රඳවා ගනී.",
                  )}
                </p>
                {notices.map((e) => (
                  <button
                    key={e.id}
                    className={`sim-event ${e.level}`}
                    onClick={() =>
                      e.asset
                        ? chooseModel(e.asset)
                        : setToast(
                            t(
                              "System-wide event; no single mapped asset.",
                              "පද්ධති මට්ටමේ සිදුවීමකි; තනි සිතියම් වත්කමක් නොමැත.",
                            ),
                          )
                    }
                  >
                    <span>
                      {gridTime(e.time)}
                      <i>{e.level}</i>
                    </span>
                    <p>{language === "si" ? e.textSi : e.text}</p>
                    {e.asset && (
                      <small>
                        <Crosshair size={12} />
                        {t("Locate", "සොයන්න")} {e.asset}
                      </small>
                    )}
                  </button>
                ))}
                {!notices.length && (
                  <p className="sim-empty">
                    {t(
                      "No events in this category.",
                      "මෙම වර්ගයේ සිදුවීම් නොමැත.",
                    )}
                  </p>
                )}
              </>
            )}
            {section === "restoration" &&
              (state.restoration ? (
                <Restoration
                  state={state}
                  language={language}
                  send={send}
                  locate={chooseModel}
                />
              ) : (
                <div className="sim-restoration-empty">
                  <Zap size={32} />
                  <h2>
                    {t(
                      "Bring the island back online",
                      "දිවයින යළි සජීවී කරන්න",
                    )}
                  </h2>
                  <p>
                    {t(
                      "Practice a black start: auxiliary supply, hydro startup, transmission energization, and staged load pickup.",
                      "සහායක බලය, ජල ජනනය, සම්ප්‍රේෂණ සජීවීකරණය සහ පියවරෙන් භාර සම්බන්ධ කිරීම පුහුණු වන්න.",
                    )}
                  </p>
                  <button
                    className="sim-button"
                    onClick={() => {
                      setScenario("black-start");
                      setSettings(true);
                    }}
                  >
                    {t(
                      "Set up restoration scenario",
                      "ප්‍රතිස්ථාපන අවස්ථාව සකසන්න",
                    )}
                  </button>
                </div>
              ))}
            {section === "sources" && (
              <>
                <div className="sim-notice">
                  <ShieldCheck size={19} />
                  <span>
                    {t(
                      "Traceable geography. Explicit assumptions.",
                      "මූලාශ්‍ර සහිත භූගෝලය. පැහැදිලි උපකල්පන.",
                    )}
                  </span>
                </div>
                <h2 className="sim-section-title">
                  {t("What is real?", "සැබෑ දත්ත මොනවාද?")}
                </h2>
                <p>
                  {t(
                    "The OpenStreetMap basemap and researched infrastructure layer show Sri Lankan plants, substations and mapped transmission segments. Select any feature for its source and location confidence.",
                    "OpenStreetMap සහ පර්යේෂිත වත්කම් ස්තරය ශ්‍රී ලංකා බලාගාර, උපපොළ හා සම්ප්‍රේෂණ කොටස් පෙන්වයි. මූලාශ්‍ර සහ ස්ථාන නිරවද්‍යතාව සඳහා වත්කමක් තෝරන්න.",
                  )}
                </p>
                <h2 className="sim-section-title">
                  {t("What is simulated?", "සමාකරණය කරන්නේ කුමක්ද?")}
                </h2>
                <p>
                  {t(
                    "Interactive dispatch uses a reduced 10-bus, 18-corridor model. These corridors are not surveyed CEB circuits. MW loading, frequency, relay timing, economics and storage parameters are modeled; reference-only stations do not contribute to its generation total.",
                    "අන්තර්ක්‍රියාකාරී ජනනය බස්බාර 10ක, මාර්ග 18ක සරල ආකෘතියකි. මේවා මිනුම් කළ ලංවිම රැහැන් නොවේ. භාරය, සංඛ්‍යාතය, ආරක්ෂණ කාල හා ආර්ථිකය ආකෘතිගතය. යොමු බලාගාර ජනන එකතුවට ඇතුළත් නොවේ.",
                  )}
                </p>
                <p>
                  {t(
                    "DC active-power flows and simplified island-frequency dynamics are used. AC voltage, reactive power, N−1 compliance, phase-angle synchronization and utility-grade protection studies are outside this model.",
                    "DC සක්‍රිය බල ප්‍රවාහ සහ සරල සංඛ්‍යාත ගතික භාවිත වේ. AC වෝල්ටීයතාව, ප්‍රතික්‍රිය බලය, N−1 හා කලා සමමුහුර්තකරණය මෙම ආකෘතියේ නොමැත.",
                  )}
                </p>
                <h2 className="sim-section-title">
                  {t("Source library", "මූලාශ්‍ර පුස්තකාලය")}
                </h2>
                {Array.from(new Set(sites.map((s) => s.sourceUrl))).map(
                  (url, i) => (
                    <a
                      className="sim-source-link"
                      href={url}
                      key={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <BookOpen size={15} />
                      {t("Infrastructure reference", "වත්කම් මූලාශ්‍රය")}{" "}
                      {i + 1}
                      <ArrowUpRight size={14} />
                    </a>
                  ),
                )}
                <a
                  className="sim-source-link"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap · ODbL <ArrowUpRight size={14} />
                </a>
                <p className="sim-caption">
                  {t(
                    "Educational simulation. Not connected to real equipment or suitable for operational switching decisions.",
                    "අධ්‍යාපනික සමාකරණයකි. සැබෑ උපකරණවලට සම්බන්ධ නැති අතර මෙහෙයුම් තීරණ සඳහා නොවේ.",
                  )}
                </p>
              </>
            )}
          </div>
          <footer className="sim-sidebar-footer">
            <ShieldCheck size={13} />
            {t(
              "Research-backed · Model limits disclosed",
              "පර්යේෂණ මත · ආකෘති සීමා පැහැදිලියි",
            )}
          </footer>
        </aside>
      )}
      <section className="sim-main">
        <div className="sim-map-toolbar">
          <div className="sim-toolbar-title">
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              aria-label={t("Toggle sidebar", "පැති පුවරුව මාරු කරන්න")}
            >
              <Menu size={18} />
            </button>
            <span>
              {t("Sri Lanka", "ශ්‍රී ලංකාව")}
              <ChevronRight size={13} />
              <b>
                {layer === "infrastructure"
                  ? t("Infrastructure atlas", "වත්කම් සිතියම")
                  : t("Operational model", "මෙහෙයුම් ආකෘතිය")}
              </b>
            </span>
          </div>
          <div className="sim-toolbar-actions">
            <div className="sim-segments">
              <button
                className={layer === "infrastructure" ? "active" : ""}
                onClick={() => setLayer("infrastructure")}
              >
                <MapIcon size={14} />
                {t("Atlas", "සිතියම")}
              </button>
              <button
                className={layer === "operations" ? "active" : ""}
                onClick={() => setLayer("operations")}
              >
                <Activity size={14} />
                {t("Simulation", "සමාකරණය")}
              </button>
            </div>
            <button
              className={showLabels ? "sim-icon-active" : ""}
              onClick={() => setShowLabels(!showLabels)}
              title={t("Toggle map labels", "සිතියම් නම් මාරු කරන්න")}
              aria-label={t("Toggle map labels", "සිතියම් නම් මාරු කරන්න")}
            >
              <Layers size={17} />
            </button>
          </div>
        </div>
        <div className="sim-map-area">
          <MapView
            sessionKey={mapSession}
            onLocateModel={chooseModel}
            state={state}
            sites={sites}
            routes={transmissionRoutes}
            selectedId={selectedId}
            focusId={focusId}
            focusRequest={focusRequest}
            onSelect={choose}
            layer={layer}
            showLabels={showLabels}
            language={language}
          />
          <div className="sim-map-caption">
            <span>
              {layer === "infrastructure"
                ? t(
                    "MAPPED INFRASTRUCTURE · SELECTED COVERAGE",
                    "සිතියම්ගත වත්කම් · තෝරාගත් ආවරණය",
                  )
                : t("REDUCED 10-BUS MODEL", "බස්බාර 10ක සරල ආකෘතිය")}
            </span>
            <small>
              {layer === "infrastructure"
                ? `${sites.length} ${t("locations", "ස්ථාන")} · ${transmissionRoutes.length} ${t("route segments", "මාර්ග කොටස්")}`
                : t(
                    "Dashed corridors + dotted equipment connections · model geometry",
                    "ඉරි කඩ සම්බන්ධතා ආකෘති මාර්ගයි; සැබෑ රැහැන් නොවේ",
                  )}
            </small>
          </div>
          <div className="sim-map-key">
            {layer === "infrastructure" ? (
              <>
                <span>
                  <i style={{ background: "#7c3aed" }} />
                  220 kV
                </span>
                <span>
                  <i style={{ background: "#0d9488" }} />
                  132 kV
                </span>
              </>
            ) : (
              <>
                <span>
                  <i style={{ background: "#168d7d" }} />
                  {t("Closed", "සම්බන්ධයි")}
                </span>
                <span>
                  <i style={{ background: "#cd8c22" }} />
                  {t("High load", "ඉහළ භාරය")}
                </span>
                <span>
                  <i style={{ background: "#d83d53" }} />
                  {t("Trip / overload", "විසන්ධි / අධිභාර")}
                </span>
              </>
            )}
            <span>
              <i className="dashed" />
              {t("Model", "ආකෘතිය")}
            </span>
          </div>
          {state.finished && (
            <div className="sim-outcome">
              <strong>
                {state.outcome === "blackout"
                  ? t("Simulation stopped", "සමාකරණය නැවතුණා")
                  : t("Scenario complete", "අවස්ථාව සම්පූර්ණයි")}
              </strong>
              <p>
                {state.failureCause
                  ? language === "si"
                    ? state.failureCauseSi
                    : state.failureCause
                  : t(
                      "Review the event log and dispatch history.",
                      "සිදුවීම් හා ජනන ඉතිහාසය පරීක්ෂා කරන්න.",
                    )}
              </p>
              <button onClick={() => nav("events")}>
                {t("Review events", "සිදුවීම් බලන්න")}
              </button>
              <button onClick={() => setSettings(true)}>
                {t("New scenario", "නව අවස්ථාව")}
              </button>
            </div>
          )}
        </div>
        <section className={`sim-telemetry ${chartOpen ? "" : "collapsed"}`}>
          <header>
            <div>
              <TrendingUp size={16} />
              <strong>{t("Supply & demand", "සැපයුම හා ඉල්ලුම")}</strong>
              <span>{t("MW · simulated", "MW · සමාකෘති")}</span>
            </div>
            <div>
              <button
                disabled={!ready || state.finished}
                onClick={() => {
                  send({ type: "plan" });
                  setToast(
                    t(
                      "Forecast baseline updated from current targets.",
                      "වත්මන් ඉලක්ක අනුව පුරෝකථනය යාවත්කාලීන කළා.",
                    ),
                  );
                }}
              >
                {t("Update dispatch plan", "ජනන සැලැස්ම යාවත්කාලීන කරන්න")}
              </button>
              <button
                onClick={() => setChartOpen(!chartOpen)}
                aria-label={
                  chartOpen
                    ? t("Collapse chart", "වක්‍ර හකුළන්න")
                    : t("Expand chart", "වක්‍ර විහිදුවන්න")
                }
              >
                {chartOpen ? <X size={16} /> : <TrendingUp size={16} />}
              </button>
            </div>
          </header>
          {chartOpen && (
            <Forecast state={state} language={language} compact fitContainer />
          )}
        </section>
      </section>
      {selectedId && (site || route || asset || line) && (
        <aside className="sim-inspector">
          <div className="sim-panel-heading">
            <div>
              <span className="sim-eyebrow">
                {t("ASSET INSPECTOR", "වත්කම් පරීක්ෂකය")}
              </span>
              <h2>
                {site
                  ? language === "si"
                    ? site.nameSi
                    : site.name
                  : (route?.name ??
                    (asset
                      ? assetName(asset, language)
                      : `${t("Model corridor", "ආකෘති මාර්ගය")} ${line?.id}`))}
              </h2>
            </div>
            <button
              onClick={() => setSelectedId("")}
              aria-label={t("Close inspector", "පරීක්ෂකය වසන්න")}
            >
              <X size={18} />
            </button>
          </div>
          <div className="sim-panel-content">
            {site && (
              <>
                <span className="sim-badge">
                  {site.simulationId
                    ? t("DISPATCH-LINKED SITE", "ජනනයට සම්බන්ධ ස්ථානය")
                    : t("REFERENCE INFRASTRUCTURE", "යොමු වත්කම")}
                </span>
                <p className="sim-caption">{site.description}</p>
                <dl className="sim-properties">
                  <div>
                    <dt>{t("Location", "ස්ථානය")}</dt>
                    <dd>
                      {site.lat.toFixed(5)}° N<br />
                      {site.lon.toFixed(5)}° E
                    </dd>
                  </div>
                  {site.capacityMW && (
                    <div>
                      <dt>{t("Reference capacity", "යොමු ධාරිතාව")}</dt>
                      <dd>{site.capacityMW} MW</dd>
                    </div>
                  )}
                  {site.voltageKV && (
                    <div>
                      <dt>{t("Voltage class", "වෝල්ටීයතා පන්තිය")}</dt>
                      <dd>{site.voltageKV} kV</dd>
                    </div>
                  )}
                  <div>
                    <dt>{t("Location confidence", "ස්ථාන විශ්වාසය")}</dt>
                    <dd>
                      {site.confidence === "mapped"
                        ? t("OSM mapped", "OSM සිතියම්ගත")
                        : t("Approximate", "ආසන්න")}
                    </dd>
                  </div>
                </dl>
                <div className="sim-source-pair">
                  <a href={site.sourceUrl} target="_blank" rel="noreferrer">
                    {t("Asset source", "වත්කම් මූලාශ්‍රය")}
                    <ArrowUpRight size={13} />
                  </a>
                  <a
                    href={site.locationSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Map source", "සිතියම් මූලාශ්‍රය")}
                    <ArrowUpRight size={13} />
                  </a>
                </div>
                {!asset && (
                  <div className="sim-notice">
                    {t(
                      "This is a researched reference asset. It is not connected to the reduced dispatch model and is not reporting live telemetry.",
                      "මෙය පර්යේෂිත යොමු වත්කමකි. සරල ජනන ආකෘතියට සම්බන්ධ නැති අතර සජීවී දත්ත සපයන්නේ නැත.",
                    )}
                  </div>
                )}
              </>
            )}
            {asset && assetControls(asset)}
            {route && (
              <>
                <span className="sim-badge">
                  {route.confidence === "mapped"
                    ? t("MAPPED ROUTE", "සිතියම්ගත මාර්ගය")
                    : t("APPROXIMATE ROUTE", "ආසන්න මාර්ගය")}
                </span>
                <dl className="sim-properties">
                  <div>
                    <dt>{t("Voltage", "වෝල්ටීයතාව")}</dt>
                    <dd>{route.voltageKV || t("Unknown", "නොදනී")} kV</dd>
                  </div>
                  <div>
                    <dt>{t("Operating telemetry", "මෙහෙයුම් දත්ත")}</dt>
                    <dd>{t("Not available", "නොමැත")}</dd>
                  </div>
                </dl>
                <p>
                  {t(
                    "Mapped geometry does not establish electrical connectivity, circuit rating or current service status. This route is not a switchable model circuit.",
                    "සිතියම් ජ්‍යාමිතිය මගින් විදුලි සම්බන්ධතාව, ධාරිතාව හෝ වත්මන් තත්ත්වය තහවුරු නොවේ. මෙය මාරු කළ හැකි ආකෘති රැහැනක් නොවේ.",
                  )}
                </p>
                <a
                  className="sim-source-link"
                  target="_blank"
                  rel="noreferrer"
                  href={route.sourceUrl}
                >
                  {t("Inspect route source", "මාර්ග මූලාශ්‍රය බලන්න")}
                  <ArrowUpRight size={14} />
                </a>
              </>
            )}
            {line && (
              <>
                <span className="sim-badge">
                  {t("SIMULATED CORRIDOR", "සමාකෘති මාර්ගය")}
                </span>
                <div className="sim-reading">
                  <strong>
                    {number(Math.abs(line.flow))}
                    <small> MW</small>
                  </strong>
                  <span>
                    {number((100 * Math.abs(line.flow)) / line.capacity)}%
                  </span>
                </div>
                <dl className="sim-properties">
                  <div>
                    <dt>{t("Connection", "සම්බන්ධතාව")}</dt>
                    <dd>
                      S{line.from + 1} → S{line.to + 1}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Model rating", "ආකෘති ධාරිතාව")}</dt>
                    <dd>{line.capacity} MW</dd>
                  </div>
                  <div>
                    <dt>{t("Breaker", "පරිපථ කඩනය")}</dt>
                    <dd>
                      {line.online
                        ? t("Closed", "සංවෘතයි")
                        : t("Open", "විවෘතයි")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Thermal exposure", "තාප නිරාවරණය")}</dt>
                    <dd>{number(line.heat, 1)} / 12</dd>
                  </div>
                </dl>
                {line.tripReason && (
                  <div className="sim-notice">{line.tripReason}</div>
                )}
                <button
                  className="sim-button"
                  disabled={state.finished || line.lockout > 0}
                  onClick={() => send({ type: "toggle", id: line.id })}
                >
                  {line.online
                    ? t("Open breaker", "කඩනය විවෘත කරන්න")
                    : t("Close breaker", "කඩනය සම්බන්ධ කරන්න")}
                </button>
                {line.lockout > 0 && (
                  <p>
                    {t("Protection lockout", "ආරක්ෂණ අගුල")}:{" "}
                    {Math.ceil(line.lockout)} s
                  </p>
                )}
                <p className="sim-caption">
                  {t(
                    "This simplified connection is not the surveyed route or operational rating of a real CEB circuit.",
                    "මෙම සරල සම්බන්ධතාව සැබෑ ලංවිම රැහැනක මිනුම් මාර්ගය හෝ මෙහෙයුම් ධාරිතාව නොවේ.",
                  )}
                </p>
              </>
            )}
          </div>
        </aside>
      )}
      <footer className="sim-bottom">
        <div className="sim-run-controls">
          <button
            className={state.paused ? "sim-run" : "sim-pause"}
            disabled={!ready || state.finished}
            onClick={() => send({ type: "pause" })}
          >
            {state.paused ? <Play size={15} /> : <Pause size={15} />}
            <span>
              {state.paused ? t("Run", "අරඹන්න") : t("Pause", "නවත්වන්න")}
            </span>
          </button>
          <div className="sim-clock">
            <strong>{gridTime(state.time)}</strong>
            <small>{t("SIM TIME", "සමාකරණ කාලය")}</small>
          </div>
          <select
            aria-label={t("Simulation speed", "සමාකරණ වේගය")}
            value={state.speed}
            onChange={(e) =>
              send({ type: "speed", value: Number(e.target.value) })
            }
          >
            {[1, 2, 5, 10, 30].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
          <span className="sim-clock-rate">
            {state.speed * CLOCK_RATE}{" "}
            {t("grid seconds / second", "ජාල තත්පර / තත්පරය")}
          </span>
        </div>
        <button className="sim-last-event" onClick={() => nav("events")}>
          <Bell size={14} />
          <span>
            {state.events[0]
              ? language === "si"
                ? state.events[0].textSi
                : state.events[0].text
              : t("Simulation ready", "සමාකරණය සූදානම්")}
          </span>
        </button>
        <button
          className="sim-scenario-button"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={16} />
          {t("Scenario", "අවස්ථාව")}
        </button>
      </footer>
      {toast && (
        <div className="sim-toast" role="status">
          <Check size={16} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {settings && (
        <div className="sim-modal-backdrop">
          <section
            className="sim-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Configure scenario", "අවස්ථාව සකසන්න")}
          >
            <button
              className="sim-modal-close"
              onClick={() => setSettings(false)}
              aria-label={t("Close scenario settings", "අවස්ථා සැකසුම් වසන්න")}
            >
              <X size={19} />
            </button>
            <span className="sim-eyebrow">LANKA / GRID SIMULATOR</span>
            <h2>
              {t("Your next operating scenario", "ඔබේ ඊළඟ මෙහෙයුම් අවස්ථාව")}
            </h2>
            <p>
              {t(
                "Choose a challenge. Starting a new scenario replaces the current session; your manually saved session stays available.",
                "අභියෝගයක් තෝරන්න. නව අවස්ථාව වත්මන් සැසිය ප්‍රතිස්ථාපනය කරයි; සුරැකි සැසිය රඳවා ගනී.",
              )}
            </p>
            <label htmlFor="scenario-choice">{t("Scenario", "අවස්ථාව")}</label>
            <select
              id="scenario-choice"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioId)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {language === "si" ? s.nameSi : s.name}
                </option>
              ))}
            </select>
            <p className="sim-notice">
              {language === "si"
                ? SCENARIOS.find((s) => s.id === scenario)?.descriptionSi
                : SCENARIOS.find((s) => s.id === scenario)?.description}
            </p>
            <button className="sim-button" onClick={reset} disabled={!ready}>
              <RotateCcw size={16} />
              {t("Initialize scenario", "අවස්ථාව ආරම්භ කරන්න")}
            </button>
            <div className="sim-modal-actions">
              <button onClick={save}>
                <Save size={15} />
                {t("Save current session", "වත්මන් සැසිය සුරකින්න")}
              </button>
              <button disabled={!saveAvailable} onClick={load}>
                <ArrowDownToLine size={15} />
                {t("Load saved session", "සුරැකි සැසිය පූරණය කරන්න")}
              </button>
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="sim-modal-backdrop">
          <section
            className="sim-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Quick guide", "ඉක්මන් මාර්ගෝපදේශය")}
          >
            <button
              className="sim-modal-close"
              onClick={() => setHelp(false)}
              aria-label={t("Close guide", "මාර්ගෝපදේශය වසන්න")}
            >
              <X size={19} />
            </button>
            <span className="sim-eyebrow">
              {t("WELCOME TO YOUR WORKSPACE", "ඔබේ වැඩබිමට සාදරයෙන්")}
            </span>
            <h2>
              {t("Explore. Understand. Operate.", "ගවේෂණය. අවබෝධය. මෙහෙයුම.")}
            </h2>
            {[
              [
                "01",
                t("Explore the atlas", "සිතියම ගවේෂණය කරන්න"),
                t(
                  "Drag to pan and scroll to zoom. Select a symbol or search the asset explorer for a plant and its sources.",
                  "සිතියම ඇද ගෙන යන්න; රෝදයෙන් විශාල කරන්න. බලාගාරයක් හා මූලාශ්‍ර සොයා ගැනීමට සංකේතයක් තෝරන්න.",
                ),
              ],
              [
                "02",
                t("Switch to simulation", "සමාකරණයට මාරු වන්න"),
                t(
                  "The Simulation layer shows modeled connections. Select a dispatch-linked station, adjust its MW target, and press Run.",
                  "සමාකරණ ස්තරය ආකෘති සම්බන්ධතා පෙන්වයි. ජනන බලාගාරයක් තෝරා MW ඉලක්කය සකසා අරඹන්න.",
                ),
              ],
              [
                "03",
                t("Keep the system balanced", "පද්ධතිය සමතුලිතව තබන්න"),
                t(
                  "Watch 50 Hz, line loading and the supply/demand curves. Event-log entries take you to affected equipment. Pause whenever you need time.",
                  "Hz 50, රැහැන් භාර හා සැපයුම්/ඉල්ලුම් වක්‍ර බලන්න. සිදුවීම් සටහනෙන් අදාළ උපකරණ සොයාගත හැක. අවශ්‍ය විට නවත්වන්න.",
                ),
              ],
            ].map(([n, h, p]) => (
              <div className="sim-guide-step" key={n}>
                <b>{n}</b>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
            <button
              className="sim-button"
              onClick={() => {
                setHelp(false);
                nav("assets");
              }}
            >
              {t("Explore the network", "ජාලය ගවේෂණය කරන්න")}
              <ChevronRight size={16} />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
