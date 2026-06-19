// 投稿コンポーザー（オーケストレータ）: 画像選択 → クロップ → フィルタ → 一言 → 投稿。
//
// 一言必須は 2 層で担保する:
//   - UI: 送信ボタンを !caption.trim() || !hasImage || posting で disabled
//   - ロジック: buildNoteTemplate（signAndPublishNote 内）が空一言を throw
// 出力 1:1 は renderSquareImageFromRect（canvas.width=height=size）で構造的に保証。

import { useEffect, useRef, useState } from "react";
import { renderSquareImageFromRect, type SquareCropRect } from "../../lib/image/crop.ts";
import { insertTag, removeTag } from "../../lib/image/hashtag-complete.ts";
import { composeEdgeBlur, composeFilterCss, composeSharpen, composeToneAmount, composeToneCurve, composeVignette, type SelectedFilter } from "../../lib/image/presets.ts";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { fetchKnownHashtags, fetchPopularHashtags, signAndPublishNote } from "../../lib/nostr/client.ts";
import { extractHashtags } from "../../lib/nostr/tags.ts";
import { deleteImage, uploadImage } from "../../lib/nostr/upload.ts";
import { recordRecentTags } from "../../lib/plants/recent-tags.ts";
import { clearDraft, loadDraft, saveMeta, syncBlobs } from "../../lib/composer/draft.ts";
import Icon from "../ui/Icon.tsx";
import AccountName from "../account/AccountName.tsx";
import CaptionInput from "./CaptionInput.tsx";
import DandelionBurst from "./DandelionBurst.tsx";
import CropFrame from "./CropFrame.tsx";
import FilterChips from "./FilterChips.tsx";
import ImagePicker from "./ImagePicker.tsx";
import TagPicker from "./TagPicker.tsx";

type Status = { kind: "idle" } | { kind: "posting" } | { kind: "done" } | { kind: "error"; message: string };
type DraftImage = {
  id: string;
  file: File;
  src: string;
  crop: SquareCropRect | null;
  filters: SelectedFilter[];
};

const MAX_IMAGES = 4;

function makeDraftImage(file: File): DraftImage {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return { id, file, src: URL.createObjectURL(file), crop: null, filters: [] };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = src;
  });
}

function centeredSquareRect(image: HTMLImageElement): SquareCropRect {
  const size = Math.max(1, Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.9));
  return {
    sx: Math.round((image.naturalWidth - size) / 2),
    sy: Math.round((image.naturalHeight - size) / 2),
    size,
  };
}

export default function Composer() {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [popular, setPopular] = useState<RankedTag[]>([]);
  // タグチップ挿入/解除のたびに increment し、CaptionInput にキャレットを末尾へ送る合図にする（#165）。
  // 0 は初期値（発火しない）。手打ち補完（applyCandidate）はこの経路を通らず従来どおり。
  const [focusEndSignal, setFocusEndSignal] = useState(0);
  // ユーザー名（#28）。AccountName が表示・保存を担い、現在名だけ受け取って投稿ゲートに使う。
  const [name, setName] = useState<string | null>(null);
  // 投稿の進捗（#252）。アップロードは枚数が分かるので「写真を送信中 N/M」、その後の署名・publish は
  // 「投稿中…」と出す。綿毛（DandelionBurst）が active={posting} で舞い続けるので、ボタンの段階表示と
  // 合わせて「10秒間ずっと動いている＝固まっていない」が伝わる。null は非投稿中。
  const [postProgress, setPostProgress] = useState<{ stage: "upload" | "publish"; done: number; total: number } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const imagesRef = useRef<DraftImage[]>([]);
  // 下書きの自動保存・復元（#228）。復元完了までは保存系の effect を黙らせる（hydration ガード）。
  // false の間に初期 images=[] / 空 caption が走って下書きを上書き消去するのを防ぐ race 回避。
  const hydratedRef = useRef(false);
  // 直近で blobs ストアへ sync 済みの写真集合キー（id 列／並び）。復元直後はここに復元集合キーを控え、
  // blobs effect が「いま読んだばかりの blob」を clear+putAll で書き戻す無駄＝事故を止める（#228）。
  const lastSyncedKeyRef = useRef<string | null>(null);

  // マウント時に下書きを復元する（#228・非同期）。IndexedDB から blob＋メタを読み、
  // blob から Object URL と File を再生成して DraftImage[] を組み直す。
  // 成功/失敗どちらでも完了後に hydratedRef を立て、以降の保存 effect を解禁する。
  useEffect(() => {
    let alive = true;
    void loadDraft()
      .then((snapshot) => {
        if (!alive || snapshot === null) return;
        const restored: DraftImage[] = snapshot.images.map((img) => {
          const file = new File([img.blob], img.name, { type: img.type });
          return { id: img.id, file, src: URL.createObjectURL(file), crop: img.crop, filters: img.filters };
        });
        if (restored.length === 0) return;
        // 復元した集合キーを控える（blobSetKey と同じ作り方で揃える）。これで直後に発火する
        // blobs effect が blobSetKey === lastSyncedKeyRef となり、読んだばかりの blob を書き戻さない。
        lastSyncedKeyRef.current = restored.map((img) => img.id).join(" ");
        setImages(restored);
        setCaption(snapshot.caption);
        setCurrentId(snapshot.currentId ?? restored[0]!.id);
      })
      .catch(() => {})
      .finally(() => {
        // 復元の有無に関わらず保存系を解禁する（成功時は復元後の値から、失敗時は現状から保存される）。
        if (alive) hydratedRef.current = true;
      });
    return () => {
      alive = false;
    };
  }, []);

  // 保存（blobs・重い側）: 写真集合（id 列／並び）が前回 sync 時と変わった時だけ blobs ストアを現在の集合へ一致させる（#228）。
  // 復元前（hydration ガード）は何もしない。並び順は配列添字 i を order として焼く。
  //
  // 「集合が変わった時だけ」に絞る理由: crop/filters は images 配列内の DraftImage で変わるが blob 自体には
  // 無関係なので、これらの編集で全 blob（数MB×最大4枚）を IndexedDB に書き直すのは無駄（crop/filters は meta 側の
  // デバウンス保存に任せる）。さらに復元直後は lastSyncedKeyRef に復元集合キーを控えてあるので、blobSetKey と一致＝
  // 「いま読んだばかりの blob」を clear+putAll で書き戻さない。
  // 一方、写真を実際に外して集合が変わった時（空配列＝blobSetKey="" を含む）は lastSyncedKeyRef と不一致になり
  // syncBlobs([]) が走って blobs をクリアする＝外した写真が IDB に残って復活する事故を防ぐ（空でも早期 return しない）。
  const blobSetKey = images.map((img) => img.id).join(" ");
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (blobSetKey === lastSyncedKeyRef.current) return; // 復元/前回と同じ写真集合は書き戻さない。
    lastSyncedKeyRef.current = blobSetKey;
    void syncBlobs(
      images.map((img, i) => ({ id: img.id, blob: img.file, name: img.file.name, type: img.file.type, order: i })),
    );
    // 依存は集合キーのみ（images 全体に依存しない＝crop/filter 変更で再書き込みしない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobSetKey]);

  // 保存（meta・軽い側）: 本文・各写真のクロップ枠/フィルタ・並び順・選択中 id が変わったら
  // 約 1000ms デバウンスで meta を保存する（#228）。復元前（hydration ガード）は何もしない。
  // 写真ゼロなら保存しない（写真の無い下書きは loadDraft が null を返す＝復元不能なので、meta を書く意味がない＝orphan）。
  // meta effect は images の中身（crop/filters）変化に依存し、blobs effect は集合キーにだけ依存する——この非対称は意図的
  // （crop/filters は blob を書き直さず meta だけ更新したい・blob は重いので集合が変わった時だけ書く）。
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (images.length === 0) return;
    const timer = setTimeout(() => {
      void saveMeta({
        caption,
        currentId,
        items: images.map((img) => ({ id: img.id, crop: img.crop, filters: img.filters })),
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [caption, currentId, images]);

  // 空になったら下書きを全消去する（#228）。写真ゼロ かつ 本文も空＝書きかけが無い状態。
  // 「本文を自分で空にする」「最後の写真を外す」がこの経路。復元前は何もしない。
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (images.length === 0 && caption.trim() === "") void clearDraft();
  }, [images, caption]);

  // マウント時に過去タグ（補完プール）と人気タグ（ピッカー）を取得（失敗は空のまま）。
  useEffect(() => {
    let alive = true;
    fetchKnownHashtags()
      .then((tags) => {
        if (alive) setPool(tags);
      })
      .catch(() => {});
    fetchPopularHashtags()
      .then((tags) => {
        if (alive) setPopular(tags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 選択画像の Object URL をアンマウント時に revoke。
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.src);
    };
  }, []);

  function handleSelectImages(picked: File[], rejectedCount = 0) {
    if (picked.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const nextImages = picked.slice(0, remaining).map(makeDraftImage);
    if (nextImages.length === 0) return;
    setImageNotice(rejectedCount > 0 ? "写真は4枚までです。追加できる分だけ追加しました。" : null);
    setImages((prev) => [...prev, ...nextImages]);
    setCurrentId(nextImages[0]!.id);
    for (const draft of nextImages) {
      void loadImage(draft.src).then((image) => {
        const crop = centeredSquareRect(image);
        setImages((prev) =>
          prev.map((item) => (item.id === draft.id && item.crop === null ? { ...item, crop } : item)),
        );
      });
    }
    setStatus({ kind: "idle" });
  }

  function updateCurrentImage(patch: Partial<Pick<DraftImage, "crop" | "filters">>) {
    if (currentId === null) return;
    setImages((prev) => prev.map((image) => (image.id === currentId ? { ...image, ...patch } : image)));
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const removed = prev.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.src);
      const next = prev.filter((image) => image.id !== id);
      if (currentId === id) setCurrentId(next[0]?.id ?? null);
      return next;
    });
    setStatus({ kind: "idle" });
    setImageNotice(null);
  }

  function resetAll() {
    for (const image of images) URL.revokeObjectURL(image.src);
    setImages([]);
    setCurrentId(null);
    setCaption("");
    setImageNotice(null);
  }

  const currentImage = images.find((image) => image.id === currentId) ?? images[0] ?? null;
  const hasImage = images.length > 0;
  const posting = status.kind === "posting";
  // 名前必須（#28）＝「ユーザー名を入れたら投稿できる」。設定は AccountName 側で完了済み。
  const hasName = name !== null && name.trim() !== "";
  const allCropsReady = images.length > 0 && images.every((image) => image.crop !== null);
  const canSubmit = caption.trim() !== "" && hasImage && hasName && allCropsReady && !posting;

  // 投稿ボタンが押せない理由（不足条件）。ボタン近くに出して「なぜ押せない？」を消す。
  const missing: string[] = [];
  if (!hasName) missing.push("ユーザー名");
  if (!hasImage) missing.push("写真");
  if (caption.trim() === "") missing.push("ひとこと");
  if (hasImage && !allCropsReady) missing.push("写真の枠");

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!allCropsReady) {
      setStatus({ kind: "error", message: "クロップ範囲が未確定です。枠を調整してください。" });
      return;
    }
    setStatus({ kind: "posting" });
    // 綿毛は active={posting} で投稿の全尺ずっと舞う（#252）。ボタンは段階テキストで進捗を出す。
    setPostProgress({ stage: "upload", done: 0, total: images.length });
    // 複数枚は並列にアップロードする（#167・直列 for は枚数分だけ遅い）。
    // orderedUrls は Promise.all の結果＝images 順（imageUrls の順序保証）。
    // uploadedUrls は完了順に積む cleanup 専用（失敗時に成功分だけ deleteImage する）。
    const uploadedUrls: string[] = [];
    try {
      const orderedUrls = await Promise.all(
        images.map(async (draft, index) => {
          if (draft.crop === null) throw new Error("クロップ範囲が未確定です。枠を調整してください。");
          const image = await loadImage(draft.src);
          const blob = await renderSquareImageFromRect(
            image,
            draft.crop,
            composeFilterCss(draft.filters),
            composeVignette(draft.filters),
            composeSharpen(draft.filters),
            composeEdgeBlur(draft.filters),
            composeToneCurve(draft.filters),
            composeToneAmount(draft.filters),
          );
          const squareFile = new File([blob], `hanoba-${index + 1}.jpg`, { type: "image/jpeg" });
          const { url } = await uploadImage(squareFile);
          uploadedUrls.push(url);
          // 1枚アップロードが終わるたびに「送信中 N/M」を進める（完了順・枚数だけ確実に増える）。
          setPostProgress((p) => (p !== null && p.stage === "upload" ? { ...p, done: p.done + 1 } : p));
          return url;
        }),
      );
      // 写真は全部送り終え、ここから署名・relay への publish（枚数では測れないので「投稿中…」）。
      setPostProgress({ stage: "publish", done: images.length, total: images.length });
      await signAndPublishNote({ caption, imageUrls: orderedUrls });
      // 投稿に実際に含まれたタグだけを「最近使った」に記録する（タップしただけは入れない）。
      recordRecentTags(extractHashtags(caption));
      resetAll();
      // 投稿成功＝下書きの役目は終わり。永続化も消す（/me 遷移の前・#228）。
      void clearDraft();
      setStatus({ kind: "done" });
      // 投稿直後は「自分の植物」へ遷移し、増えた1枚を一番上に見せる（時系列降順）。
      if (typeof window !== "undefined") window.location.href = "/me";
    } catch (err) {
      await Promise.allSettled(uploadedUrls.map((url) => deleteImage(url)));
      setPostProgress(null);
      const message = err instanceof Error ? err.message : "投稿に失敗しました。";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AccountName onChange={setName} promptLabel="はじめまして。ハンドルネームは？" />

      {!hasImage ? (
        <div className="py-6">
          <ImagePicker onSelect={handleSelectImages} remaining={MAX_IMAGES} />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-medium text-ha-green-deep">写真</h2>
              <span className="text-sm font-semibold text-ha-ink/70">{images.length}/{MAX_IMAGES}枚</span>
            </div>
            {imageNotice !== null && <p className="text-xs font-medium text-ha-pink">{imageNotice}</p>}
            <div className="relative flex gap-2 overflow-visible pb-1">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setCurrentId(image.id)}
                  aria-pressed={image.id === currentImage?.id}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    image.id === currentImage?.id ? "border-ha-green" : "border-ha-white/40"
                  }`}
                >
                  <img src={image.src} alt={`${index + 1}枚目`} className="h-full w-full object-cover" />
                  {image.crop === null && (
                    <span className="absolute inset-x-0 bottom-0 bg-ha-pink/85 py-0.5 text-[10px] font-semibold text-ha-white">
                      未設定
                    </span>
                  )}
                </button>
              ))}
              {images.length < MAX_IMAGES && (
                <div className="shrink-0 self-start">
                  <ImagePicker onSelect={handleSelectImages} remaining={MAX_IMAGES - images.length} compact />
                </div>
              )}
            </div>
          </section>

          {currentImage !== null && (
            <CropFrame
              key={currentImage.id}
              src={currentImage.src}
              imgRef={imgRef}
              initialCrop={currentImage.crop}
              filter={composeFilterCss(currentImage.filters)}
              vignette={composeVignette(currentImage.filters)}
              sharpen={composeSharpen(currentImage.filters)}
              edgeBlur={composeEdgeBlur(currentImage.filters)}
              toneCurve={composeToneCurve(currentImage.filters)}
              toneAmount={composeToneAmount(currentImage.filters)}
              onCropComplete={(crop) => updateCurrentImage({ crop })}
            />
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ha-green-deep">フィルタ</h2>
            <FilterChips
              selected={currentImage?.filters ?? []}
              onChange={(filters) => updateCurrentImage({ filters })}
            />
          </section>

          <CaptionInput value={caption} onChange={setCaption} pool={pool} focusEndSignal={focusEndSignal} />

          {/* タグは手打ちせず選んで入れる（#22）。本文に #タグ テキストとして挿入される。
              チップ挿入/解除の後はキャレットを本文末尾へ送る（#165・focusEndSignal を増やす）。 */}
          <TagPicker
            popular={popular}
            caption={caption}
            onPick={(tag) => {
              setCaption((c) => insertTag(c, tag));
              setFocusEndSignal((n) => n + 1);
            }}
            onRemove={(tag) => {
              setCaption((c) => removeTag(c, tag));
              setFocusEndSignal((n) => n + 1);
            }}
          />

          {/* なぜ押せないかを明示（不足条件）。posting 中は出さない。 */}
          {!posting && missing.length > 0 && (
            <p
              id="hanoba-compose-shortfall"
              role="status"
              aria-live="polite"
              className="text-right text-xs text-ha-ink/55"
            >
              あと <span className="text-ha-pink font-medium">{missing.join("、")}</span>{" "}
              を入れると投稿できます
            </p>
          )}

          {/* 主アクション（投稿する）を右端に・グループは右寄せ（基本動線）。
              副アクション（選び直す）は左、主アクションは右。 */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => (currentImage ? removeImage(currentImage.id) : resetAll())}
              disabled={posting}
              className="glass rounded-full text-ha-ink px-4 py-3 hover:border-ha-green/50 disabled:opacity-40 transition-colors"
            >
              {images.length > 1 ? "この写真を外す" : "写真を選び直す"}
            </button>
            {/* 送信ボタンは relative なラッパで包み、綿毛オーバーレイ（#148/#252）をボタンに重ねる。
                オーバーレイは pointer-events:none・aria-hidden なのでクリックやレイアウトに干渉しない。 */}
            <div className="relative">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-describedby={!posting && missing.length > 0 ? "hanoba-compose-shortfall" : undefined}
                className="inline-flex items-center gap-2 rounded-full bg-ha-pink text-ha-white px-6 py-3 font-semibold shadow-sm shadow-ha-pink/30 enabled:hover:opacity-90 enabled:hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? (
                  // 綿はボタンから飛び出した側なので、ボタンに残す稼働サインは綿マークではなく
                  // 普通のスピナーリング（#252）。段階テキストで「送信中 N/M → 投稿中」を出す。
                  <>
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-ha-white/40 border-t-ha-white animate-spin motion-reduce:animate-none"
                    />
                    {postProgress?.stage === "upload"
                      ? `写真を送信中 ${postProgress.done}/${postProgress.total}`
                      : "投稿中…"}
                  </>
                ) : (
                  <>
                    <Icon name="dandelion" className="h-5 w-5" />
                    投稿する
                  </>
                )}
              </button>
              <DandelionBurst active={posting} />
            </div>
          </div>
        </>
      )}

      {status.kind === "done" && (
        <p role="status" className="glass rounded-2xl text-ha-ink px-4 py-3 text-sm">
          投稿しました。あなたの植物へ移動します…
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="glass rounded-2xl text-ha-pink px-4 py-3 text-sm">
          {status.message}
        </p>
      )}
    </div>
  );
}
