import { useEffect, useState } from "react";
import { fetchProfiles } from "../../lib/nostr/client.ts";
import type { Profile } from "../../lib/feed/parse.ts";

// 取得済みプロフィールのモジュールキャッシュ（フィード再描画・タグ絞り込みで再取得しない）。
// 取得を試みた pubkey は、リトライ予算を使い切ってから空 Profile を入れて無限再取得を防ぐ。
const cache = new Map<string, Profile>();

const EMPTY: Profile = { name: null, picture: null, about: null, websites: [] };

// 著者プロフィールの bounded retry（#103 デグレ修正）。
// 単発の fetchProfiles は、接続直後やモバイル回線で lagging relay が EOSE 前に
// 取りこぼすことがある。以前は取りこぼした著者を即 EMPTY で恒久キャッシュしていたため、
// 一度ミスると名前/アイコンが永久に出ず npub フォールバック表示で固定されていた。
// 取りこぼしは即確定せず、最大 RETRY_LIMIT 回まで RETRY_DELAY_MS 間隔で引き直す
// （#93 の fetchMyProfileResilient と同じ思想を著者ヘッダ経路にも適用）。
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 700;

/**
 * 著者プロフィール（kind:0）を一括取得して pubkey→Profile の Map を返す（#35・#103）。
 * 未取得の pubkey だけまとめて fetchProfiles し、結果をキャッシュ。取りこぼした著者は
 * bounded retry（最大 RETRY_LIMIT 回・RETRY_DELAY_MS 間隔）で引き直し、予算を使い切るまで
 * EMPTY 確定しない。取得前は Map に入らない＝呼び出し側は npub フォールバック表示にする。
 */
export function useProfiles(pubkeys: string[]): Map<string, Profile> {
  const [, bump] = useState(0);
  // 取得対象キー（重複除去・空除去）。依存配列の安定化のため結合文字列にする。
  const uniq = [...new Set(pubkeys)].filter((p) => p !== "");
  const key = [...uniq].sort().join(",");

  useEffect(() => {
    const missing = uniq.filter((p) => !cache.has(p));
    if (missing.length === 0) return;
    let alive = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 取りこぼした著者だけを再帰的に引き直す。alive ガードで unmount / 対象変更後の
    // 遅延コールバックを無効化する。relay 呼び出しは client（fetchProfiles）に集約済み。
    const run = (targets: string[]): void => {
      fetchProfiles(targets)
        .catch(() => new Map<string, Profile>())
        .then((m) => {
          if (!alive) return;
          for (const [k, v] of m) cache.set(k, v);
          const still = targets.filter((p) => !cache.has(p));
          if (still.length > 0 && attempt < RETRY_LIMIT) {
            attempt++;
            timer = setTimeout(() => {
              if (alive) run(still);
            }, RETRY_DELAY_MS);
          } else {
            // リトライ予算を使い切ったので、残りを EMPTY 確定して再取得ループを断つ。
            for (const p of still) if (!cache.has(p)) cache.set(p, EMPTY);
          }
          bump((n) => n + 1);
        });
    };
    run(missing);

    return () => {
      alive = false;
      if (timer !== null) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const view = new Map<string, Profile>();
  for (const p of uniq) {
    const v = cache.get(p);
    if (v !== undefined) view.set(p, v);
  }
  return view;
}
