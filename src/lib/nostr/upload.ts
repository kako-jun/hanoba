// 画像アップロード（nostr.build・NIP-98 認証）。
// EXIF はサーバ側で自動削除されるため、自宅 GPS 等の身バレ対策が無料で効く。

import { NOSTR_BUILD_UPLOAD_URL, NOSTR_BUILD_DELETE_BASE } from "./constants.ts";
import { buildNip98AuthEvent } from "./events.ts";
import { signTemplate } from "./keys.ts";

interface UploadResponse {
  status?: string;
  data?: Array<{ url?: string }>;
}

/**
 * nostr.build の画像 URL から SHA-256 ハッシュ（ファイル ID）を取り出す。
 * 形式: https://image.nostr.build/<hash>.<ext> / https://nostr.build/i/<hash>.<ext>
 * ハッシュ（64桁 hex）でなければ null。
 */
export function extractNostrBuildHash(url: string): string | null {
  try {
    const filename = new URL(url).pathname.split("/").pop();
    if (filename === undefined || filename === "") return null;
    const hash = filename.replace(/\.[^.]+$/, "");
    return /^[a-f0-9]{64}$/i.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

/**
 * nostr.build にアップロードした画像を削除する（NIP-96 delete・NIP-98 認証）。
 * アップロード者本人の鍵で署名する＝本人の画像だけ消せる（#28）。
 *
 * - URL から SHA を取り出し DELETE `https://nostr.build/api/v2/nip96/upload/<hash>`。
 * - nostr.build URL でない / SHA を取り出せない場合は false（消すものが無い）。
 * - mypace と同じ機構をバックエンドなしで再現する。
 */
export async function deleteImage(url: string): Promise<boolean> {
  const hash = extractNostrBuildHash(url);
  if (hash === null) return false;

  const deleteUrl = `${NOSTR_BUILD_DELETE_BASE}/${hash}`;
  const authEvent = buildNip98AuthEvent(deleteUrl, "DELETE");
  const signedAuthEvent = await signTemplate(authEvent);
  const authHeader = btoa(JSON.stringify(signedAuthEvent));

  const res = await fetch(deleteUrl, {
    method: "DELETE",
    headers: { Authorization: `Nostr ${authHeader}` },
  });
  return res.ok;
}

/**
 * 画像 1 枚を nostr.build にアップロードし、公開 URL を返す。
 *
 * 手順:
 *   1. NIP-98 認証イベント（kind:27235, u/method タグ）を署名
 *   2. base64(JSON) を Authorization: "Nostr <base64>" ヘッダに載せる
 *   3. multipart/form-data の "file" フィールドで POST
 *   4. レスポンス { status:"success", data:[{ url }] } から data[0].url を返す
 */
export async function uploadImage(file: File): Promise<{ url: string }> {
  const authEvent = buildNip98AuthEvent(NOSTR_BUILD_UPLOAD_URL, "POST");
  const signedAuthEvent = await signTemplate(authEvent);
  const authHeader = btoa(JSON.stringify(signedAuthEvent));

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(NOSTR_BUILD_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Nostr ${authHeader}` },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`画像アップロードに失敗しました（HTTP ${res.status}）`);
  }

  const json = (await res.json()) as UploadResponse;
  const url = json.data?.[0]?.url;
  if (typeof url !== "string" || url === "") {
    throw new Error("画像アップロードのレスポンスに URL が含まれていません");
  }

  return { url };
}
