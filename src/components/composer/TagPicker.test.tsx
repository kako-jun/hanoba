import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TagPicker from "./TagPicker.tsx";

type Handlers = { onPick: ReturnType<typeof vi.fn>; onRemove: ReturnType<typeof vi.fn> };

function renderPicker(opts: { popular?: { tag: string; count: number }[]; caption?: string } = {}): Handlers {
  const onPick = vi.fn();
  const onRemove = vi.fn();
  render(
    <TagPicker popular={opts.popular ?? []} caption={opts.caption ?? ""} onPick={onPick} onRemove={onRemove} />,
  );
  return { onPick, onRemove };
}

/** ドリルダウンを開いて アガベ の品種一覧まで降りる。 */
async function drillToAgave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
  await user.click(await screen.findByRole("button", { name: /多肉植物/ }));
  await user.click(await screen.findByRole("button", { name: /アガベ/ }));
}

describe("TagPicker", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("世話/記録のクイックタグを選ぶと onPick が1回呼ばれる", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(onPick.mock.calls).toEqual([["水やり"]]);
  });

  it("投稿の種類「質問」「失敗」をタップすると前置なしで onPick が1回（投稿タイプ単一タグ・#311）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    // 投稿の種類は variety-catalog 外＝カテゴリ/属を前置しない（tagsToPick は [name] を返す）。
    await user.click(screen.getByRole("button", { name: "#質問" }));
    await user.click(screen.getByRole("button", { name: "#失敗" }));
    expect(onPick.mock.calls).toEqual([["質問"], ["失敗"]]);
  });

  it("本文に入っているタグは満たされた色（aria-pressed=true）になる", () => {
    renderPicker({ caption: "今日は #水やり した" });
    expect(screen.getByRole("button", { name: "#水やり" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "#開花" })).toHaveAttribute("aria-pressed", "false");
  });

  it("選択済みチップを再タップすると onRemove で外れる（onPick は呼ばない）", async () => {
    const user = userEvent.setup();
    const { onPick, onRemove } = renderPicker({ caption: "今日は #水やり した" });
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(onRemove.mock.calls).toEqual([["水やり"]]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("品種を選ぶと #カテゴリ #属 #品種 を カテゴリ→属→品種 の順で入れる（#312）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));
    expect(onPick.mock.calls).toEqual([["多肉植物"], ["アガベ"], ["チタノタ"]]);
  });

  it("「#属 をこのまま使う」は カテゴリ→属 を入れる（#312・カテゴリも付く）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: /#アガベ をこのまま使う/ }));
    expect(onPick.mock.calls).toEqual([["多肉植物"], ["アガベ"]]);
  });

  it("「#カテゴリ をこのまま使う」でカテゴリ単独タグを入れる（#312）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.click(await screen.findByRole("button", { name: /多肉植物/ }));
    await user.click(await screen.findByRole("button", { name: /#多肉植物 をこのまま使う/ }));
    expect(onPick.mock.calls).toEqual([["多肉植物"]]);
  });

  it("品種選択で #カテゴリ #属 #品種 を入れる・本文の上位は外さない（#312）", async () => {
    const user = userEvent.setup();
    const { onPick, onRemove } = renderPicker({ caption: "今日の一鉢\n#パキポディウム" });
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    // mock onPick は本文重複ガード（実 Composer の insertTag 側）を持たないので3回記録する。
    expect(onPick.mock.calls).toEqual([["塊根植物"], ["パキポディウム"], ["グラキリス"]]);
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("入れた品種を再タップ解除すると同属に兄弟が残らなければ属も連動して外れる（#181）", async () => {
    // #181 で入れた #属 #品種 の本文を再現。品種チップを再タップ→兄弟不在なので属も外す。
    const user = userEvent.setup();
    const { onPick, onRemove } = renderPicker({ caption: "今日の一鉢\n#パキポディウム #グラキリス " });
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    // 本文にあるので満たされた色（再タップ＝解除）。
    const chip = await screen.findByRole("button", { name: /#グラキリス/ });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await user.click(chip);
    expect(onPick).not.toHaveBeenCalled();
    expect(onRemove.mock.calls).toEqual([["グラキリス"], ["パキポディウム"]]);
  });

  it("#312 本文（#カテゴリ #属 #品種）から品種を再タップ解除すると 品種→属→カテゴリ を連動撤去（#312）", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderPicker({ caption: "今日の一鉢\n#塊根植物 #パキポディウム #グラキリス " });
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    const chip = await screen.findByRole("button", { name: /#グラキリス/ });
    await user.click(chip);
    expect(onRemove.mock.calls).toEqual([["グラキリス"], ["パキポディウム"], ["塊根植物"]]);
  });

  it("カテゴリ label＝品種名 の衝突でも品種解除で上位を孤立させない（本番カタログ・エアプランツ／イオナンタ・#312）", async () => {
    // エアプランツ›チランジア›「イオナンタ」。カテゴリ「エアプランツ」と同字の品種「エアプランツ」が
    // 同属に居るので、衝突ガードが無いと #エアプランツ を兄弟と誤認して上位が残る（リグレッション）。
    const user = userEvent.setup();
    const { onRemove } = renderPicker({ caption: "今日の一鉢\n#エアプランツ #チランジア #イオナンタ " });
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "イオナンタ");
    const chip = await screen.findByRole("button", { name: /#イオナンタ/ });
    await user.click(chip);
    expect(onRemove.mock.calls).toEqual([["イオナンタ"], ["チランジア"], ["エアプランツ"]]);
  });

  it("人気の“属”をタップしたら挿入せず階層（品種一覧）に入る", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker({ popular: [{ tag: "パキポディウム", count: 5 }] });
    await user.click(screen.getByRole("button", { name: "#パキポディウム" }));
    expect(await screen.findByRole("button", { name: "#グラキリス" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /#パキポディウム をこのまま使う/ })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("パネル内の検索で品種を引くと #カテゴリ #属 #品種 を カテゴリ→属→品種 の順で挿入する（#312）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    expect(onPick.mock.calls).toEqual([["塊根植物"], ["パキポディウム"], ["グラキリス"]]);
  });

  it("検索でカテゴリを引いてタップすると #カテゴリ 単独を入れる（#312）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "ハーブ");
    // カテゴリヒット（「カテゴリ」文脈付き）。タップで `#ハーブ` 単独を入れる。
    await user.click(await screen.findByRole("button", { name: /#ハーブ\s*カテゴリ/ }));
    expect(onPick.mock.calls).toEqual([["ハーブ"]]);
  });

  it("pickable=false の見出しグループ配下の品種は カテゴリ→品種（見出し属は前置しない・#312）", async () => {
    // リドレイ は ビカクシダ › 原種（pickable:false）配下。pickable でない見出し属はタグにしないが、
    // カテゴリ（ビカクシダ）は #312 で付ける＝onPick は カテゴリ→品種 の2回。
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "リドレイ");
    await user.click(await screen.findByRole("button", { name: /#リドレイ/ }));
    expect(onPick.mock.calls).toEqual([["ビカクシダ"], ["リドレイ"]]);
  });

  it("品種選択は onPick を カテゴリ→属→品種 の順に3回呼ぶ（順序固定・#312）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));
    expect(onPick).toHaveBeenCalledTimes(3);
    expect(onPick).toHaveBeenNthCalledWith(1, "多肉植物");
    expect(onPick).toHaveBeenNthCalledWith(2, "アガベ");
    expect(onPick).toHaveBeenNthCalledWith(3, "チタノタ");
  });

  it("検索はかな/カナ・大小・全半角を無視する（ぐらきりす→グラキリス）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "ぐらきりす");
    expect(await screen.findByRole("button", { name: /#グラキリス/ })).toBeTruthy();
  });

  it("検索で該当が無くても「そのまま使う」でフリーフォーム挿入できる", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "我が家のレア株");
    await user.click(await screen.findByRole("button", { name: /そのまま #我が家のレア株 を使う/ }));
    expect(onPick.mock.calls).toEqual([["我が家のレア株"]]);
  });

  it("INLINE_LIMIT を超える行に「その他」ボタンが出る（世話・記録とも・#169）", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: "世話のその他のタグ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "記録のその他のタグ" })).toBeTruthy();
  });

  it("インラインに出ていない定番（株分け）は常時表示されず、「その他」を開くと見える（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    // 株分け は世話の作業順で先頭7件（インライン）には出ない＝あふれ側
    expect(screen.queryByRole("button", { name: "#株分け" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "世話のその他のタグ" }));
    const dialog = screen.getByRole("dialog", { name: "世話のタグ一覧" });
    expect(within(dialog).getByRole("button", { name: "#株分け" })).toBeTruthy();
  });

  it("「その他」ポップアップにはインライン済みの定番（水やり）は出ない＝あふれ分だけ（#186）", async () => {
    const user = userEvent.setup();
    renderPicker();
    // 水やり は世話の先頭＝インライン表示済み。インラインには出る。
    expect(screen.getByRole("button", { name: "#水やり" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "世話のその他のタグ" }));
    const dialog = screen.getByRole("dialog", { name: "世話のタグ一覧" });
    // ポップアップ内にはインライン済みの 水やり は出ない（重複させない・#186）。
    expect(within(dialog).queryByRole("button", { name: "#水やり" })).toBeNull();
    // あふれ分（株分け）は出る。
    expect(within(dialog).getByRole("button", { name: "#株分け" })).toBeTruthy();
  });

  it("ポップアップ内のチップを選ぶと onPick が呼ばれる（#169）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: "記録のその他のタグ" }));
    const dialog = screen.getByRole("dialog", { name: "記録のタグ一覧" });
    await user.click(within(dialog).getByRole("button", { name: "#休眠" }));
    expect(onPick.mock.calls).toEqual([["休眠"]]);
  });

  it("「その他」ボタンの aria-expanded は開閉に追従する（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    const btn = screen.getByRole("button", { name: "世話のその他のタグ" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("ポップアップは × で閉じる（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "世話のその他のタグ" }));
    expect(screen.getByRole("dialog", { name: "世話のタグ一覧" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "タグ一覧を閉じる" }));
    expect(screen.queryByRole("dialog", { name: "世話のタグ一覧" })).toBeNull();
  });

  it("ポップアップは Esc で閉じる（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "記録のその他のタグ" }));
    expect(screen.getByRole("dialog", { name: "記録のタグ一覧" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "記録のタグ一覧" })).toBeNull();
  });

  it("ポップアップは囲み外クリックで閉じる（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: "世話のその他のタグ" }));
    expect(screen.getByRole("dialog", { name: "世話のタグ一覧" })).toBeTruthy();
    await user.click(screen.getByText("タグを選ぶ"));
    expect(screen.queryByRole("dialog", { name: "世話のタグ一覧" })).toBeNull();
  });

  it("追加リクエストリンクが /vote（市役所の品種要望板）に向く・GitHub に飛ばさない（#169/#232）", () => {
    renderPicker();
    const link = screen.getByRole("link", { name: /追加をリクエスト/ });
    const href = link.getAttribute("href")!;
    expect(href).toBe("/vote");
    expect(href).not.toContain("github.com");
    // 合成中の下書きを保つため新規タブで開く（draft 自動保存 #228 とも両立）。
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("ドリルダウンの品種チップに学名を併記する（チタノタ→Agave titanota・#200）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await drillToAgave(user);
    const chip = await screen.findByRole("button", { name: "#チタノタ" });
    // 学名は補助だが品種名(#label)と同じチップ内に併記される（#200）。
    expect(chip).toHaveTextContent("Agave");
    expect(chip).toHaveTextContent("titanota");
    // 属チップ「#アガベ をこのまま使う」には学名を出さない（品種だけ・#200）。
    const genusChip = await screen.findByRole("button", { name: /#アガベ をこのまま使う/ });
    expect(genusChip).not.toHaveTextContent("Agave titanota");
  });

  it("パネル内検索の品種チップに学名を併記する（グラキリス→Pachypodium・#200）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    const chip = await screen.findByRole("button", { name: /#グラキリス/ });
    expect(chip).toHaveTextContent("Pachypodium");
  });

  it("学名(sci)の無い品種チップには学名要素を出さない（苔玉・#200）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "苔玉");
    const chip = await screen.findByRole("button", { name: /#苔玉/ });
    // sci が無いので和名のみ＝学名併記要素（data-sci）が付かない（SciName 内部クラスに結合しない・#200）。
    expect(chip.querySelector("[data-sci]")).toBeNull();
  });

  it("検索結果の“属”チップには学名を出さない（学名は品種だけ・#200）", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "パキポディウム");
    // 属ヒット（階層誘導の › 付き）には学名併記要素（data-sci）が無い。
    const genusChip = await screen.findByRole("button", { name: /#パキポディウム\s*塊根植物/ });
    expect(genusChip.querySelector("[data-sci]")).toBeNull();
  });

  it("世話/記録のクイックタグには学名を出さない（品種だけ・#200）", () => {
    renderPicker();
    const careChip = screen.getByRole("button", { name: "#水やり" });
    expect(careChip.querySelector("[data-sci]")).toBeNull();
  });

  it("「最近使った」は localStorage（過去の投稿）から読み、タップでは増やさない", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hanoba:recent-tags", JSON.stringify(["チタノタ"]));
    renderPicker();

    const recent = screen.getByText("最近使った").parentElement!;
    expect(within(recent).getByRole("button", { name: "#チタノタ" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "#開花" }));
    expect(JSON.parse(window.localStorage.getItem("hanoba:recent-tags")!)).toEqual(["チタノタ"]);
  });
});
