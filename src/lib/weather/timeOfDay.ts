// 時刻（JST）→ 時間帯（#231 後段②）。
//
// 背景写真は差し替えず、同じ絵にかけるオーバーレイの暗さ・色温度を時間帯で変調する
// （明度は全段ダークレンジ内＝暗色シックを崩さない）。軸は鼓門の時刻＝JST で、ユーザーの
// タイムゾーンに依らず「みんな同じハノーバの今」を共有する（天気＝鼓門固定と同じ思想）。

export type TimeOfDay = "morning" | "day" | "evening" | "night";

/** JST の時(0-23) を朝/昼/夕/夜に大別する純関数。
 *  夜=19:00-翌5:00 / 朝=5-9 / 昼=9-16 / 夕=16-19。 */
export function timeOfDay(jstHour: number): TimeOfDay {
  if (jstHour < 5 || jstHour >= 19) return "night";
  if (jstHour < 9) return "morning";
  if (jstHour < 16) return "day";
  return "evening";
}

/** 与えた時刻の JST(Asia/Tokyo) の時(0-23) を返す純関数（環境 TZ に依存しない）。
 *  Date を引数で受けるのでテスト可能。 */
export function jstHour(date: Date): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "numeric",
    hour12: false,
  }).format(date);
  // 一部実装は深夜 0 時を "24" で返すため 24 で丸める。
  return parseInt(h, 10) % 24;
}
