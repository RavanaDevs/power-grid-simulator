"use client";
import type { State, Command } from "@/game/engine";
import { assetName, translate, type Language } from "@/game/i18n";
export default function Restoration({
  state: s,
  language,
  send,
  locate,
}: {
  state: State;
  language: Language;
  send: (c: Command) => void;
  locate: (id: string) => void;
}) {
  const t = translate(language),
    r = s.restoration;
  if (!r)
    return (
      <p>
        {t(
          "Choose ‘Bring back the lights’ from the mission menu.",
          "මෙහෙයුම් මෙනුවෙන් ‘නැවත විදුලිය ලබා දෙන්න’ තෝරන්න.",
        )}
      </p>
    );
  const hydro = s.assets.find((a) => a.id === "G4")!;
  const live = s.busFrequency.filter((f) => f > 0).length;
  const restored = Math.round(100 * (1 - s.unserved / Math.max(1, s.demand)));
  return (
    <div className="restoration-procedure">
      <div className="restoration-status">
        <strong>{restored}%</strong>
        <span>
          {t("demand restored", "ඉල්ලුම යථා තත්ත්වයට")}
          <br />
          {live}/10 {t("buses energized", "බස්බාර සජීවීයි")}
        </span>
      </div>
      <progress
        value={restored}
        max={100}
        aria-label={t("Restoration progress", "ප්‍රතිස්ථාපන ප්‍රගතිය")}
      />
      <p>
        {t(
          "Breakers start open; loads are disconnected. Follow these steps, watch 50 Hz, and bring the island back one community at a time.",
          "කඩන විවෘතයි; පාරිභෝගිකයන් විසන්ධියි. මෙම පියවර අනුගමනය කරමින් Hz 50 පවත්වාගෙන ජනාවාස එකින් එක සම්බන්ධ කරන්න.",
        )}
      </p>
      {s.paused && (
        <button className="game-button" onClick={() => send({ type: "pause" })}>
          {t("Resume restoration clock", "ප්‍රතිස්ථාපන කාලය අරඹන්න")}
        </button>
      )}
      <section>
        <h3>01 · {t("Station auxiliary power", "බලාගාර සහායක බලය")}</h3>
        <p>
          {t(
            "Use 2 MWh of the mission's emergency reserve to power station controls and auxiliaries.",
            "පාලන සහ සහායක උපකරණ සඳහා මෙහෙයුමේ හදිසි සංචිතයෙන් MWh 2ක් යොදන්න.",
          )}
        </p>
        <button
          disabled={r.auxiliary || s.finished}
          onClick={() => send({ type: "auxiliary" })}
        >
          {r.auxiliary
            ? t("✓ Auxiliaries ready", "✓ සහායක බලය සූදානම්")
            : t("Establish auxiliary supply", "සහායක සැපයුම අරඹන්න")}
        </button>
      </section>
      <section>
        <h3>
          02 ·{" "}
          {t("Establish a reference frequency", "යොමු සංඛ්‍යාතයක් පිහිටුවන්න")}
        </h3>
        <p>
          {t(
            "Upper Kotmale is this mission’s designated black-start unit. Start its 8-second sequence with no load connected.",
            "මෙම මෙහෙයුමේ ස්වයං ආරම්භක ඒකකය ඉහළ කොත්මලේයි. භාර සම්බන්ධ නොකර තත්පර 8ක ආරම්භක අනුක්‍රමය අරඹන්න.",
          )}
        </p>
        <div className="restoration-row">
          <button onClick={() => locate("G4")}>
            {assetName(hydro, language)} ↗
          </button>
          <button
            disabled={
              !r.auxiliary || hydro.online || !!hydro.starting || s.finished
            }
            onClick={() => send({ type: "toggle", id: "G4" })}
          >
            {hydro.online
              ? "✓ 50 Hz"
              : hydro.starting
                ? `${Math.ceil(hydro.starting)} s`
                : t("Start hydro", "ජල විදුලිය අරඹන්න")}
          </button>
        </div>
      </section>
      <details open={hydro.online && live < 10}>
        <summary>
          03 ·{" "}
          {t("Energize transmission paths", "සම්ප්‍රේෂණ මාර්ග සජීවී කරන්න")}
        </summary>
        <p>
          {t(
            "Close routes from a live bus into a dead bus. Live islands require frequency matching within 0.2 Hz. Voltage, phase and reactive power are simplified here.",
            "සජීවී බස්බාරයකින් අක්‍රිය බස්බාරයකට රැහැන් සම්බන්ධ කරන්න. සජීවී කොටස්වල සංඛ්‍යාත වෙනස Hz 0.2ට අඩු විය යුතුය. වෝල්ටීයතාව, කලා හා ප්‍රතික්‍රිය බලය මෙහි සරල කර ඇත.",
          )}
        </p>
        {s.lines.map((l) => (
          <div className="restoration-row" key={l.id}>
            <button onClick={() => locate(l.id)}>
              {l.id} · S{l.from + 1} → S{l.to + 1} ↗
            </button>
            <button
              disabled={l.online || !hydro.online || !!l.lockout || s.finished}
              onClick={() => send({ type: "toggle", id: l.id })}
            >
              {l.online ? "✓" : t("Energize", "සජීවී කරන්න")}
            </button>
          </div>
        ))}
      </details>
      <details>
        <summary>
          04 · {t("Restart the generating fleet", "ජනන ඒකක නැවත අරඹන්න")}
        </summary>
        <p>
          {t(
            "A stable live bus is required. Thermal startup takes 30 simulation seconds; other units take 8. Governors follow connected demand up to each dispatch target. Increase targets to create pickup reserve.",
            "ස්ථාවර සජීවී බස්බාරයක් අවශ්‍යයි. තාප ඒකක සඳහා තත්පර 30ක්ද අනෙක් ඒකක සඳහා 8ක්ද ගතවේ. ජනන ඉලක්කය දක්වා ඉල්ලුම අනුව පාලනය වේ. සංචිතය සඳහා ඉලක්ක ඉහළ දමන්න.",
          )}
        </p>
        {s.assets
          .filter(
            (a) =>
              !["bus", "load", "battery"].includes(a.kind) && a.id !== "G4",
          )
          .map((a) => (
            <div className="restoration-row" key={a.id}>
              <button onClick={() => locate(a.id)}>
                {assetName(a, language)} ↗
              </button>
              <button
                disabled={a.online || !!a.starting || s.finished}
                onClick={() => send({ type: "toggle", id: a.id })}
              >
                {a.online
                  ? "✓"
                  : a.starting
                    ? `${Math.ceil(a.starting)} s`
                    : t("Start", "අරඹන්න")}
              </button>
            </div>
          ))}
      </details>
      <details open={live === 10}>
        <summary>
          05 ·{" "}
          {t(
            "Reconnect communities in stages",
            "ජනාවාස පියවරෙන් සම්බන්ධ කරන්න",
          )}
        </summary>
        <p>
          {t(
            "Pick up 10% at a time with reserve and stable frequency. Pause between steps while generators ramp. Use the inspector to raise dispatch limits. Restore every community, then hold stable for 20 seconds.",
            "ස්ථාවර සංඛ්‍යාතයක් හා සංචිතයක් ඇති විට 10% බැගින් සම්බන්ධ කරන්න. ජනනය ඉහළ යන තෙක් පියවර අතර රැඳෙන්න. ජනන සීමා පරීක්ෂකයෙන් ඉහළ දමන්න. සියලු ජනාවාස සම්බන්ධ කර තත්පර 20ක් ස්ථාවරව පවත්වාගන්න.",
          )}
        </p>
        {s.assets
          .filter((a) => a.kind === "load")
          .map((a) => (
            <div className="restoration-row" key={a.id}>
              <button onClick={() => locate(a.id)}>
                {assetName(a, language)} · {Math.round((a.pickup ?? 0) * 100)}%
                ↗
              </button>
              <button
                disabled={(a.pickup ?? 0) >= 0.999 || s.finished}
                onClick={() =>
                  send({
                    type: "pickup",
                    id: a.id,
                    value: Math.min(1, (a.pickup ?? 0) + 0.1),
                  })
                }
              >
                +10%
              </button>
              <button
                aria-label={`${t("Disconnect", "විසන්ධි කරන්න")} ${assetName(a, language)}`}
                disabled={!a.pickup || s.finished}
                onClick={() =>
                  send({
                    type: "pickup",
                    id: a.id,
                    value: Math.max(0, (a.pickup ?? 0) - 0.1),
                  })
                }
              >
                −10%
              </button>
            </div>
          ))}
        <p>
          {t("Stability hold", "ස්ථාවර කාලය")}: {Math.floor(r.stable)}/20 s
        </p>
      </details>
      <small>
        {t(
          "Game training only. Unit designation, startup timing and auxiliary reserve are fictional; this is not a CEB operating procedure.",
          "ක්‍රීඩා පුහුණුව සඳහා පමණි. ඒකක තේරීම, ආරම්භක කාල හා සහායක සංචිතය කල්පිතයි; මෙය ලංවිම මෙහෙයුම් ක්‍රියා පටිපාටියක් නොවේ.",
        )}
      </small>
    </div>
  );
}
