// 暦日（JST）→ 八節（#231 後段①・背景まるごと差し替え）。
//
// 背景写真を季節で差し替える軸。粒度は八節＝二十四節気の主要8つ（四立＋二分二至）で、
// 約6週間ごとに1枚。各節は「暗い夜のビザール植物部屋（黒格子・板付ビカク・アガベ・ユッカは
// 据え置き）＋塊根の状態＋季節の一鉢」で表す（屋外絵は使わない＝室内・夜・暗いを守る）。
// 背景の気分なので天文精度は不要・節の開始は近似固定日でよい。
//
// 軸は鼓門の JST＝天気・時刻と同じく「みんな同じハノーバの今」を共有する。

export type SolarPhase =
  | "risshun" // 立春 2/4〜
  | "shunbun" // 春分 3/20〜
  | "rikka" //   立夏 5/5〜
  | "geshi" //   夏至 6/21〜
  | "risshu" //  立秋 8/7〜
  | "shubun" //  秋分 9/23〜
  | "ritto" //   立冬 11/7〜
  | "toji"; //   冬至 12/22〜（翌 2/3 まで）

export const SOLAR_PHASES: SolarPhase[] = [
  "risshun",
  "shunbun",
  "rikka",
  "geshi",
  "risshu",
  "shubun",
  "ritto",
  "toji",
];

/** 月日（1-12 / 1-31）から八節を返す純関数。節の開始は近似固定日。冬至は年をまたぐ。 */
export function solarPhase(month: number, day: number): SolarPhase {
  const md = month * 100 + day; // 例: 6/20 → 620
  if (md >= 1222 || md < 204) return "toji"; // 12/22〜翌 2/3
  if (md < 320) return "risshun"; // 2/4〜3/19
  if (md < 505) return "shunbun"; // 3/20〜5/4
  if (md < 621) return "rikka"; //   5/5〜6/20
  if (md < 807) return "geshi"; //   6/21〜8/6
  if (md < 923) return "risshu"; //  8/7〜9/22
  if (md < 1107) return "shubun"; // 9/23〜11/6
  return "ritto"; //                 11/7〜12/21
}

/** 与えた時刻の JST(Asia/Tokyo) の月日から八節を返す純関数（環境 TZ 非依存・Date を引数で受ける）。 */
export function solarPhaseOf(date: Date): SolarPhase {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return solarPhase(month, day);
}
