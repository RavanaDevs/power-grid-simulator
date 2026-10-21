"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { translate, type Language } from "@/game/i18n";
const steps = [
  {
    target: ".balance-hud",
    title: "Your island needs balance.",
    body: "Keep generated power close to demand. Aim for 50 Hz. A sustained imbalance triggers protection, so pause whenever you need to think.",
  },
  {
    target: ".plant-dock",
    title: "Take control of hydro.",
    body: "Select Victoria in the Fleet window. It responds faster than thermal power and is your first tool for correcting an imbalance.",
  },
  {
    target: ".dispatch-buttons",
    title: "Give it a little more power.",
    body: "Click +25 MW or move the slider. This sets a target; the plant ramps toward it when time resumes. Try a change to continue.",
  },
  {
    target: ".action-card",
    title: "Watch a transmission route.",
    body: "This route has a thermal limit. Overload fills the relay meter; when it reaches its limit, the line trips and power transfers to other routes. A lockout must expire before reconnecting.",
  },
  {
    target: ".action-card",
    title: "Keep a reserve for trouble.",
    body: "A negative battery target charges it; a positive target supplies the grid. Stored energy is limited. Use it to bridge a generator trip or the evening peak.",
  },
  {
    target: ".time-controller",
    title: "You set the pace.",
    body: "Time is paused. Start at 1×; Space pauses. Drag the map or use WASD; wheel zooms. Drag window titles, or close them and reopen from Windows. Log events locate trouble.",
  },
];
export default function GuidedTour({
  language,
  step,
  onStep,
  onFinish,
  selected,
  changed,
}: {
  language: Language;
  step: number;
  onStep: (n: number) => void;
  onFinish: () => void;
  selected: string;
  changed: boolean;
}) {
  const t = translate(language);
  const sinhala = [
    [
      "ජාලය සමතුලිතව තබන්න.",
      "සැපයුම ඉල්ලුමට සමීපව තබා 50 Hz ඉලක්ක කරන්න. අධි හා අව සංඛ්‍යාත දෙකම ආරක්ෂණ ක්‍රියාත්මක කරයි. සිතීමට කාලය නවත්වන්න.",
    ],
    [
      "වික්ටෝරියා පාලනය කරන්න.",
      "බලාගාර කවුළුවෙන් වික්ටෝරියා තෝරන්න. ජල විදුලිය වේගයෙන් ප්‍රතිචාර දක්වන නමුත් ජල සංචිත සීමිතය.",
    ],
    [
      "ජනන ඉලක්කය වෙනස් කරන්න.",
      "+25 MW ඔබන්න හෝ ස්ලයිඩරය ගෙනයන්න. කාලය යළි ඇරඹූ විට ජනනය ඉලක්කය වෙත ළඟා වේ. ඉදිරියට යාමට වෙනසක් කරන්න.",
    ],
    [
      "සම්ප්‍රේෂණ මාර්ගයක් බලන්න.",
      "අධිබර නිසා රැහැන් උණුසුම් වේ. සීමාව ඉක්මවූ විට ස්වයංක්‍රීයව විසන්ධි වී අනෙක් රැහැන් මත බර වැඩි වේ. යළි සම්බන්ධ කිරීමට අගුළු කාලය අවසන් විය යුතුය.",
    ],
    [
      "හදිසි අවස්ථාවට බලය සුරකින්න.",
      "ඍණ බැටරි ඉලක්කයක් ආරෝපණය කරයි; ධන ඉලක්කයක් ජාලයට බලය සපයයි. ගබඩා ශක්තිය සීමිතය. අධි සංඛ්‍යාතයේදී ආරෝපණය උපකාරී වේ.",
    ],
    [
      "කාලය ඔබේ පාලනයේ.",
      "පුහුණුව අතර කාලය නවතා ඇත. 1× වේගයෙන් අරඹන්න. SPACE මගින් නවත්වන්න. සැපයුම් වක්‍ර හා සම්පත් පුවරුවෙන් ඉල්ලුම, ජලය හා වියදම් බලන්න.",
    ],
  ];
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 }),
    [size, setSize] = useState({ w: 1280, h: 720 });
  const heading = useRef<HTMLHeadingElement>(null);
  const current = steps[step],
    allowed = step === 1 ? selected === "G2" : step === 2 ? changed : true;
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const el = document.querySelector(current.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      setSize({ w: innerWidth, h: innerHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [current.target, selected]);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const width = Math.min(330, size.w - 24);
  const below = rect.top + rect.height + 18;
  const beside = rect.left > width + 35 && current.target === ".action-card";
  const top = beside
    ? Math.max(12, Math.min(size.h - 255, rect.top))
    : below + 245 < size.h
      ? below
      : Math.max(12, rect.top - 245);
  const left = beside
    ? rect.left - width - 20
    : Math.max(
        12,
        Math.min(size.w - width - 12, rect.left + rect.width / 2 - width / 2),
      );
  return (
    <div className="tour-layer">
      <div
        className="tour-highlight"
        style={{
          top: rect.top - 5,
          left: rect.left - 5,
          width: rect.width + 10,
          height: rect.height + 10,
        }}
      />
      <section
        className="tour-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        style={{ top, left, width }}
      >
        <div className="tour-caption">
          {t("FIELD TRAINING", "ප්‍රායෝගික පුහුණුව")}{" "}
          <span>
            {step + 1} / {steps.length}
          </span>
          <button
            aria-label={t("Skip guided tour", "පුහුණුව මඟහරින්න")}
            onClick={onFinish}
          >
            <X size={16} />
          </button>
        </div>
        <h2 id="tour-title" tabIndex={-1} ref={heading}>
          {language === "si" ? sinhala[step][0] : current.title}
        </h2>
        <p>{language === "si" ? sinhala[step][1] : current.body}</p>
        {!allowed && (
          <small>
            {step === 1
              ? t(
                  "Select Victoria to continue.",
                  "ඉදිරියට යාමට වික්ටෝරියා තෝරන්න.",
                )
              : t(
                  "Change the hydro target to continue.",
                  "ඉදිරියට යාමට ජනන ඉලක්කය වෙනස් කරන්න.",
                )}
          </small>
        )}
        <div className="tour-actions">
          <button onClick={onFinish}>{t("Skip tour", "මඟහරින්න")}</button>
          <button
            className="game-button"
            disabled={!allowed}
            onClick={() =>
              step === steps.length - 1 ? onFinish() : onStep(step + 1)
            }
          >
            {step === steps.length - 1
              ? t("Ready to play", "ක්‍රීඩා කරමු")
              : t("Next", "ඊළඟ")}
            {step === steps.length - 1 ? (
              <Check size={14} />
            ) : (
              <ArrowRight size={14} />
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
