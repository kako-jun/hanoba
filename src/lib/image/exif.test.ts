import { describe, expect, it } from "vitest";
import { detectShotDate, exifDateToYmd, extractExifDate, parseFilenameDate } from "./exif.ts";

describe("exifDateToYmd", () => {
  it("EXIF の YYYY:MM:DD HH:MM:SS を YYYY-MM-DD に正規化", () => {
    expect(exifDateToYmd("2024:06:15 13:45:30")).toBe("2024-06-15");
    expect(exifDateToYmd("2019:12:01 00:00:00")).toBe("2019-12-01");
  });
  it("不正・範囲外は null", () => {
    expect(exifDateToYmd("not a date")).toBeNull();
    expect(exifDateToYmd("2024:13:40 00:00:00")).toBeNull();
    expect(exifDateToYmd("")).toBeNull();
  });
});

describe("parseFilenameDate", () => {
  it("区切りあり日付を拾う", () => {
    expect(parseFilenameDate("2024-06-15 13.00.00.jpg")).toBe("2024-06-15");
    expect(parseFilenameDate("photo_2023_11_03.png")).toBe("2023-11-03");
  });
  it("連続8桁 YYYYMMDD を拾う（IMG_/PXL_ 等）", () => {
    expect(parseFilenameDate("IMG_20240615.jpg")).toBe("2024-06-15");
    expect(parseFilenameDate("PXL_20231103_133045123.jpg")).toBe("2023-11-03");
    expect(parseFilenameDate("20240615_133045.jpg")).toBe("2024-06-15");
  });
  it("妥当でない月日や日付の無い名前は null（連番やサイズを誤検出しない）", () => {
    expect(parseFilenameDate("DSC_0001.jpg")).toBeNull();
    expect(parseFilenameDate("screenshot.png")).toBeNull();
    expect(parseFilenameDate("20249999.jpg")).toBeNull(); // 月99日99は不正
    expect(parseFilenameDate("IMG_20240631.jpg")).toBeNull(); // 6月31日は存在しない（月ごと日数）
    expect(parseFilenameDate("IMG_20230229.jpg")).toBeNull(); // 2023は閏年でない＝2月29日は不正
    expect(parseFilenameDate("IMG_20240229.jpg")).toBe("2024-02-29"); // 2024は閏年＝OK
  });
});

/** DateTimeOriginal だけを持つ最小の EXIF 付き JPEG（little-endian）を組む。 */
function buildExifJpeg(dateStr: string): ArrayBuffer {
  const enc = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
  const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
  const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];

  const dateBytes = [...enc(dateStr), 0]; // ASCII + NUL（count=20）
  // TIFF: II, 0x002A, IFD0@8 / IFD0(1: ExifIFD@26) / ExifIFD(1: DateTimeOriginal ASCII len@44) / 文字列@44
  const tiff = [
    ...enc("II"),
    ...u16le(0x002a),
    ...u32le(8), // IFD0 offset
    // IFD0 @ 8
    ...u16le(1),
    ...u16le(0x8769), ...u16le(4), ...u32le(1), ...u32le(26), // ExifIFD pointer → 26
    ...u32le(0), // next IFD
    // ExifIFD @ 26
    ...u16le(1),
    ...u16le(0x9003), ...u16le(2), ...u32le(dateBytes.length), ...u32le(44), // DateTimeOriginal ASCII → 44
    ...u32le(0), // next IFD
    // 文字列 @ 44
    ...dateBytes,
  ];
  const app1Payload = [...enc("Exif"), 0, 0, ...tiff];
  const app1 = [0xff, 0xe1, ...u16le(app1Payload.length + 2), ...app1Payload];
  const jpeg = [0xff, 0xd8, ...app1, 0xff, 0xd9];
  return new Uint8Array(jpeg).buffer;
}

describe("extractExifDate", () => {
  it("DateTimeOriginal を持つ JPEG から撮影日を読む", () => {
    expect(extractExifDate(buildExifJpeg("2024:06:15 13:45:30"))).toBe("2024-06-15");
  });
  it("JPEG でない/EXIF 無しは null（例外を投げない）", () => {
    expect(extractExifDate(new Uint8Array([1, 2, 3, 4]).buffer)).toBeNull();
    expect(extractExifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
  });
});

describe("detectShotDate", () => {
  it("EXIF を優先する（EXIF があればファイル名より EXIF）", () => {
    const buf = buildExifJpeg("2024:06:15 13:45:30");
    expect(detectShotDate(buf, "IMG_20991231.jpg")).toBe("2024-06-15");
  });
  it("EXIF 無しならファイル名にフォールバック", () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer;
    expect(detectShotDate(buf, "IMG_20240615.jpg")).toBe("2024-06-15");
  });
  it("どちらも取れなければ null", () => {
    expect(detectShotDate(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, "DSC_0001.jpg")).toBeNull();
  });
});
