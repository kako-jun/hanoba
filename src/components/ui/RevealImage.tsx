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
    // src が変わるたび complete を実測。キャッシュ済みなら即表示、未ロードなら隠して再リビール。
    // true にするだけでなく false にも戻すことで、複数写真切替の2枚目以降も blur-up し直す。
    setLoaded(ref.current?.complete ?? false);
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
      onLoad={() => setLoaded(true)}
      // 壊れた画像が永久に opacity-0 で消えないように、エラーでも表示状態にする。
      onError={() => setLoaded(true)}
      className={cls}
    />
  );
}
