// 写真の撮影日（撮影年月日）の抽出（#324）。
//
// kako-jun: 投稿日（kind:1 created_at）と撮影日はズレる（毎日撮って週末にまとめ投稿する等）。
// 撮影の草（#272段階4）の連続記録/ヒートマップは**撮影日**で数えたい。そのため添付時に
// EXIF（`DateTimeOriginal`）／ファイル名から撮影日（`YYYY-MM-DD`）を吸い出す。すべてクライアント
// 完結（backendless）。EXIF パーサはフル実装でなく **DateTimeOriginal だけ**を抜く軽量版。
//
// 純関数中心でテスト可能にする（ArrayBuffer/文字列を受ける）。読み取り I/O（File→ArrayBuffer）は
// 呼び出し側（Composer）が行う。

/** EXIF の日時文字列 `"YYYY:MM:DD HH:MM:SS"` を `YYYY-MM-DD` に正規化する純関数（不正は null）。 */
export function exifDateToYmd(raw: string): string | null {
  // 例 "2024:06:15 13:45:30"。日付部だけ取り、`:` を `-` に。妥当な範囲だけ通す。
  const m = raw.trim().match(/^(\d{4})[:\-/](\d{2})[:\-/](\d{2})/);
  if (m === null) return null;
  return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** 年月日が暦として妥当なら `YYYY-MM-DD`、でなければ null（月ごとの日数・閏年も検査）。 */
function validYmd(y: number, mo: number, d: number): string | null {
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1]!;
  if (d > daysInMonth) return null; // 例 6月31日・2月30日 はファイル名の誤検出として弾く
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * ファイル名から撮影日を推定する純関数（#324）。よくある命名の連続8桁 or 区切り日付を拾う。
 * 例: `IMG_20240615.jpg` / `PXL_20240615_...` / `2024-06-15 13.00.00.jpg` / `20240615_133045.jpg`。
 * 妥当な暦日だけ返す（連番やサイズが日付に化けないよう範囲チェック）。無ければ null。
 */
export function parseFilenameDate(name: string): string | null {
  // 1) 区切りあり YYYY-MM-DD / YYYY_MM_DD / YYYY.MM.DD。
  const sep = name.match(/(20\d{2}|19\d{2})[-_.](\d{2})[-_.](\d{2})/);
  if (sep !== null) {
    const ok = validYmd(Number(sep[1]), Number(sep[2]), Number(sep[3]));
    if (ok !== null) return ok;
  }
  // 2) 連続8桁 YYYYMMDD（前後が数字でない＝13桁タイムスタンプ等の途中を拾わない）。
  for (const m of name.matchAll(/(?<!\d)(20\d{2}|19\d{2})(\d{2})(\d{2})(?!\d)/g)) {
    const ok = validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
    if (ok !== null) return ok;
  }
  return null;
}

/**
 * JPEG の ArrayBuffer から EXIF `DateTimeOriginal`（0x9003）を読んで `YYYY-MM-DD` を返す純関数（#324）。
 * フル EXIF パーサは作らず、APP1(Exif)→TIFF→IFD0→ExifIFD(0x8769)→DateTimeOriginal(0x9003) だけを辿る。
 * JPEG でない／EXIF 無し／壊れは null（例外は投げない＝添付フローを止めない）。
 */
export function extractExifDate(buffer: ArrayBuffer): string | null {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // JPEG SOI でない

    // APP1(0xFFE1) セグメントを探す。各セグメントは [マーカー2][長さ2][データ]。
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break; // マーカーでない＝以降は画像データ
      const size = view.getUint16(offset + 2);
      if (size < 2) break;
      if (marker === 0xffe1) {
        // "Exif\0\0" を確認して TIFF ヘッダ位置を返す。
        const exifStart = offset + 4;
        if (
          exifStart + 6 <= view.byteLength &&
          view.getUint32(exifStart) === 0x45786966 && // "Exif"
          view.getUint16(exifStart + 4) === 0x0000
        ) {
          return readDateTimeOriginal(view, exifStart + 6);
        }
      }
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

/** TIFF ヘッダ（tiffStart）から DateTimeOriginal を辿って `YYYY-MM-DD` を返す（無ければ null）。 */
function readDateTimeOriginal(view: DataView, tiffStart: number): string | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart);
  const le = byteOrder === 0x4949; // II=little / MM=big
  if (!le && byteOrder !== 0x4d4d) return null;
  const u16 = (p: number) => view.getUint16(p, le);
  const u32 = (p: number) => view.getUint32(p, le);
  if (u16(tiffStart + 2) !== 0x002a) return null; // TIFF マジック

  const ifd0 = tiffStart + u32(tiffStart + 4);
  // IFD0 から ExifIFD ポインタ(0x8769) を探す。
  const exifIfdPtr = findTagValue(view, ifd0, 0x8769, u16, u32);
  if (exifIfdPtr === null) return null;
  const exifIfd = tiffStart + exifIfdPtr;
  // ExifIFD から DateTimeOriginal(0x9003) の ASCII を読む。
  const dt = findAsciiTag(view, tiffStart, exifIfd, 0x9003, u16, u32);
  return dt === null ? null : exifDateToYmd(dt);
}

/** IFD(ifd) 内で tag を探し、その整数値（LONG/SHORT）を返す（無ければ null）。 */
function findTagValue(
  view: DataView,
  ifd: number,
  tag: number,
  u16: (p: number) => number,
  u32: (p: number) => number,
): number | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (u16(entry) === tag) return u32(entry + 8);
  }
  return null;
}

/** IFD(ifd) 内で tag(ASCII) を探し、その文字列を返す（無ければ null）。 */
function findAsciiTag(
  view: DataView,
  tiffStart: number,
  ifd: number,
  tag: number,
  u16: (p: number) => number,
  u32: (p: number) => number,
): string | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (u16(entry) !== tag) continue;
    const len = u32(entry + 4);
    // ASCII で 4byte 超は value 欄がオフセット、以下なら value 欄に直接。
    const dataOffset = len > 4 ? tiffStart + u32(entry + 8) : entry + 8;
    let s = "";
    for (let j = 0; j < len && dataOffset + j < view.byteLength; j++) {
      const c = view.getUint8(dataOffset + j);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
  return null;
}

/**
 * 撮影日を検出する（#324）。EXIF `DateTimeOriginal` を優先し、無ければファイル名から推定する。
 * どちらも取れなければ null（呼び出し側は created_at 日にフォールバック）。
 */
export function detectShotDate(buffer: ArrayBuffer, filename: string): string | null {
  return extractExifDate(buffer) ?? parseFilenameDate(filename);
}
