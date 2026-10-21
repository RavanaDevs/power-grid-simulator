import type { Asset } from "./engine";
export type Language = "en" | "si";
export const translate =
  (language: Language) => (english: string, sinhala: string) =>
    language === "si" ? sinhala : english;
export const assetName = (asset: Asset, language: Language) =>
  language === "si" ? asset.nameSi : asset.name;
export function kindName(kind: Asset["kind"], language: Language) {
  const names = {
    coal: ["Coal", "ගල් අඟුරු"],
    oil: ["Thermal", "තාප"],
    hydro: ["Hydro", "ජල"],
    solar: ["Solar", "සූර්ය"],
    wind: ["Wind", "සුළං"],
    battery: ["Storage", "බැටරි"],
    bus: ["Substation", "උපපොළ"],
    load: ["Demand", "ඉල්ලුම"],
  };
  return names[kind][language === "si" ? 1 : 0];
}
export const gridTime = (time: number) =>
  `${String(Math.floor(time / 3600) % 24).padStart(2, "0")}:${String(Math.floor(time / 60) % 60).padStart(2, "0")}`;
