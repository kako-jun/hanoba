// 画像アップロード（nostr.build・NIP-98 認証）。
// EXIF はサーバ側で自動削除されるため、自宅 GPS 等の身バレ対策が無料で効く。

import { NOSTR_BUILD_UPLOAD_URL } from "./constants.ts";
import { buildNip98AuthEvent } from "./events.ts";
import { signTemplate } from "./keys.ts";

interface UploadResponse {
  status?: string;
  data?: Array<{ url?: string }>;
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
