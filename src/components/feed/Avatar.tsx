interface Props {
  /** アバター画像 URL（無ければ頭文字フォールバック）。 */
  src: string | null;
  /** 表示名（頭文字フォールバックと alt に使う）。 */
  name: string;
  /** サイズ等（既定 w-6 h-6）。 */
  className?: string;
}

/**
 * 著者アバター（#35）。picture があれば丸画像、無ければ名前の頭文字を丸地に置く。
 * 装飾的なので画像 alt は空（隣にユーザー名テキストを必ず出す前提）。
 */
export default function Avatar({ src, name, className = "w-6 h-6" }: Props) {
  if (src !== null) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`${className} shrink-0 rounded-full object-cover bg-ha-green-soft`}
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 grid place-items-center rounded-full bg-ha-green-soft text-ha-green-deep text-[0.7em] font-bold`}
    >
      {initial}
    </span>
  );
}
