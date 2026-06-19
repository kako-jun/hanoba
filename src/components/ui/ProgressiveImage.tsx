import { useEffect, useRef, useState } from "react";

interface Props {
  /** 画像 URL。 */
  src: string;
  /** 代替テキスト（装飾なら空文字）。 */
  alt: string;
  /** レイアウト用クラス（object-cover/object-contain/rounded-full+サイズ等）。 */
  className?: string;
  /** 読み込み戦略（既定 lazy）。 */
  loading?: "lazy" | "eager";
  /** ドラッグ可否（カルーセルのスワイプを邪魔しないよう false にできる）。 */
  draggable?: boolean;
  /**
   * デコード完了（または失敗・キャッシュ済み即時）で1回呼ぶ任意コールバック。
   * 呼び出し側が「画像が高さを持った」タイミングを掴むため（#290 写真切替の高さ予約）。
   */
  onLoad?: () => void;
}

/**
 * blur-up リビールで現れる強化版 `<img>`（#145）。
 *
 * 非プログレッシブ画像は上から帯状に描かれて見栄えが悪い。これを避けるため、
 * デコードが終わるまで img を opacity:0 で隠し（`.ha-reveal`）、`onLoad` で
 * `data-loaded="true"` を立てて blur+わずかな scale を解きながらフェードインさせる。
 * これでカードの `.ha-rise` 出現とも素直に重なる（写真は別途その上で現像される）。
 *
 * レイアウトは触らない（ラッパで包まない）＝呼び出し側の object-cover 固定箱・
 * object-contain 内在サイズ・rounded-full アバターの3形態をそのまま壊さない。
 * 暗緑のプレースホルダ（背景）は呼び出し側の箱で出す前提。
 */
export default function ProgressiveImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  draggable,
  onLoad,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // reveal を立てると同時に親へ通知する（#290・キャッシュ済み即時／onLoad／onError の全経路で1回）。
  function reveal() {
    setLoaded(true);
    onLoad?.();
  }

  // キャッシュ済み画像は onLoad が発火しないことがある（マウント時点で complete）。
  // その場合に opacity:0 のまま永遠に消えるのを防ぐため、ref で complete を見て即 loaded にする。
  useEffect(() => {
    if (imgRef.current?.complete) reveal();
    // src が変わるたびに見る（reveal は onLoad を含むので毎 src で1回通知）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={draggable}
      onLoad={reveal}
      // 読み込み失敗（リンク切れ等）でも reveal する。さもないと opacity:0 のまま永久に
      // 見えず（素の <img> のブラウザ既定の代替表示すら出ない）レイアウトの穴になる。
      onError={reveal}
      data-loaded={loaded ? "true" : "false"}
      className={`${className} ha-reveal`.trim()}
    />
  );
}
