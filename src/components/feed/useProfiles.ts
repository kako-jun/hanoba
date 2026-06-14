import { useEffect, useState } from "react";
import { fetchProfiles } from "../../lib/nostr/client.ts";
import type { Profile } from "../../lib/feed/parse.ts";

// 取得済みプロフィールのモジュールキャッシュ（フィード再描画・タグ絞り込みで再取得しない）。
// 取得を試みた pubkey は値が空 Profile でも入れて、無限再取得を防ぐ。
const cache = new Map<string, Profile>();

const EMPTY: Profile = { name: null, picture: null, about: null, websites: [] };

/**
 * 著者プロフィール（kind:0）を一括取得して pubkey→Profile の Map を返す（#35）。
 * 未取得の pubkey だけまとめて fetchProfiles し、結果をキャッシュ。
 * 取得前は Map に入らない＝呼び出し側は npub フォールバック表示にする。
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
    fetchProfiles(missing)
      .then((m) => {
        if (!alive) return;
        for (const [k, v] of m) cache.set(k, v);
        // 取得できなかった著者も試行済みにして再取得ループを断つ。
        for (const p of missing) if (!cache.has(p)) cache.set(p, EMPTY);
        bump((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      alive = false;
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
