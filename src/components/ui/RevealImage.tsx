import { useEffect, useRef, useState } from "react";

interface Props {
  /** 画像 URL。 */
  src: string;
  /** 代替テキスト（装飾画像は ""）。 */
  alt: string;
  /** 呼び出し側の sizing/object-fit/hover 等のクラス。img に前置で付与する。 */
  className?: string;
  /** 読み込み戦略（既定 "lazy"）。 */
  loading?: "lazy" | "eager";
}

/**
 * #145 blur-up リビール・帯状ペイント回避（decoding async＋opacity/blur ゲート）。
 *
 * 素の <img loading="lazy"> はブラウザ既定で上から帯状にペイントされてダサいので、
 * decoding="async" でデコード完了まで部分描画させず、opacity/blur のゲートで
 * 「読み込み完了まで隠し、ボケ→クッキリとフェードイン」させる純表示の薄皮。relay 等の副作用なし。
 */
export default function RevealImage({ src, alt, className = "", loading = "lazy" }: Props) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // 白固着を作らない三段構え：(1) complete 実測で即表示 (2) imperative load/error で拾う
    // (3) timeout 安全網。React 合成 onLoad は hydration/キャッシュ/SSR 後の即ロードで
    // 取りこぼすので頼らず、原理的に opacity-0 で永久固着しない作りにする。
    const img = ref.current;
    if (!img) return;
    // 既に読み込み済み（キャッシュ / SSR 後の即ロード / 合成 onLoad 取りこぼし）なら実測して即表示。
    if (img.complete) {
      setLoaded(true);
      return;
    }
    // まだなら隠して再リビール待ち（src 変更時のリセット兼用。2枚目以降も blur-up し直す）。
    setLoaded(false);
    let alive = true;
    const reveal = () => {
      if (alive) setLoaded(true);
    };
    // React 合成イベントは hydration 前に発火した load を取りこぼすので imperative に張る。
    img.addEventListener("load", reveal);
    img.addEventListener("error", reveal); // 壊れた画像でも白く残さない
    // 最終安全網：何があっても一定時間で必ず表示し、白固着を原理的に作らない。
    const safety = setTimeout(reveal, 3000);
    return () => {
      alive = false;
      img.removeEventListener("load", reveal);
      img.removeEventListener("error", reveal);
      clearTimeout(safety);
    };
  }, [src]);

  const cls = [
    className,
    "transition-[opacity,filter] duration-700 ease-out motion-reduce:transition-none motion-reduce:blur-0",
    loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      // load/error は React 合成イベントを使わず effect 内で addEventListener で拾う
      // （hydration 前の取りこぼし回避・二重発火防止）。
      className={cls}
    />
  );
}
