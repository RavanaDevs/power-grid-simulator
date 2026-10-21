// Nominal 50 Hz, emergency envelope based on PUCSL Grid Code (2014).
// Delay times are shortened for gameplay, not real relay recommendations.
export const RELAYS = {
  thermalLimit: 12,
  thermalCooling: 0.7,
  lineLockout: 8,
  generatorLockout: 15,
  frequencyWarningLow: 49.5,
  frequencyWarningHigh: 50.5,
  generatorLow: 47.5,
  generatorHigh: 52.5,
  generatorDelay: 3,
  sheddingLow: 49.2,
  sheddingDelay: 4,
  blackoutDelay: 18,
  frequencyFailureDelay: 12,
};
export type ScenarioId =
  | "first-shift"
  | "generator-loss"
  | "cascade"
  | "load-rejection"
  | "dry-season"
  | "black-start";
export const SCENARIOS: {
  id: ScenarioId;
  name: string;
  nameSi: string;
  description: string;
  descriptionSi: string;
}[] = [
  {
    id: "black-start",
    name: "Bring back the lights",
    nameSi: "නැවත විදුලිය ලබා දෙන්න",
    description:
      "Start with a dark island. Establish auxiliary power, start hydro, energize routes and restore communities in stages.",
    descriptionSi:
      "අඳුරු දිවයිනකින් අරඹන්න. සහායක බලය සපයා ජල විදුලි ජනනය අරඹා රැහැන් සහ ජනාවාස පියවරෙන් පියවර සම්බන්ධ කරන්න.",
  },
  {
    id: "first-shift",
    name: "Monsoon shift",
    nameSi: "මෝසම් මුරය",
    description:
      "Keep Sri Lanka supplied through a storm at 13:00 and the evening peak.",
    descriptionSi:
      "13:00 කුණාටුව සහ සවස උපරිම ඉල්ලුම අතරතුර සැපයුම පවත්වාගන්න.",
  },
  {
    id: "generator-loss",
    name: "Lost generation",
    nameSi: "ජනනය අහිමි වීම",
    description:
      "Lakvijaya trips at 10:30. Replace lost power without exhausting reservoirs.",
    descriptionSi:
      "10:30ට ලක්විජය විසන්ධි වේ. ජලාශ හිස් නොකර අහිමි බලය සපයන්න.",
  },
  {
    id: "cascade",
    name: "Cascade watch",
    nameSi: "දාම බිඳවැටීම",
    description:
      "A western corridor fault at 09:00 redistributes power onto constrained routes.",
    descriptionSi:
      "09:00ට බස්නාහිර මාර්ගයක දෝෂයක් නිසා අනෙක් රැහැන්වල බර ඉහළ යයි.",
  },
  {
    id: "load-rejection",
    name: "Sudden demand loss",
    nameSi: "හදිසි ඉල්ලුම් පහළ යාම",
    description:
      "At 10:30, 55% of demand disappears for 90 grid minutes. Reduce output or charge storage before overfrequency protection trips.",
    descriptionSi:
      "10:30ට ඉල්ලුමෙන් 55%ක් ජාල මිනිත්තු 90කට අඩුවේ. අධි සංඛ්‍යාත ආරක්ෂණය ක්‍රියා කිරීමට පෙර ජනනය අඩු කරන්න හෝ බැටරි ආරෝපණය කරන්න.",
  },
  {
    id: "dry-season",
    name: "Dry season",
    nameSi: "වියළි සමය",
    description:
      "Reservoirs start low. Conserve water and manage the cost of thermal backup.",
    descriptionSi:
      "ජලාශවල ජලය අඩුය. ජලය සුරකිමින් තාප ජනනයේ වියදම පාලනය කරන්න.",
  },
];
export const heatingRate = (loading: number) =>
  Math.max(0, loading * loading - 1);
export const secondsToTrip = (loading: number, heat: number) =>
  loading > 1
    ? Math.max(0, (RELAYS.thermalLimit - heat) / heatingRate(loading))
    : Infinity;
