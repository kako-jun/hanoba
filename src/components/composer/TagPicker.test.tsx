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

  it("品種を選ぶとその品種タグだけを入れる（カテゴリ・属を前置しない・1鉢1札 #166）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));
    expect(onPick.mock.calls).toEqual([["チタノタ"]]);
  });

  it("「#属 をこのまま使う」は属だけを入れる（カテゴリは入れない・#166）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: /#アガベ をこのまま使う/ }));
    expect(onPick.mock.calls).toEqual([["アガベ"]]);
  });

  it("本文に上位属タグがある状態で品種を選ぶと、葉を入れ上位属を外す（1鉢1札 #166）", async () => {
    const user = userEvent.setup();
    const { onPick, onRemove } = renderPicker({ caption: "今日の一鉢\n#パキポディウム" });
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    expect(onPick.mock.calls).toEqual([["グラキリス"]]);
    expect(onRemove.mock.calls).toEqual([["パキポディウム"]]);
  });

  it("人気の“属”をタップしたら挿入せず階層（品種一覧）に入る", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker({ popular: [{ tag: "パキポディウム", count: 5 }] });
    await user.click(screen.getByRole("button", { name: "#パキポディウム" }));
    expect(await screen.findByRole("button", { name: "#グラキリス" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /#パキポディウム をこのまま使う/ })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("パネル内の検索で品種を引き、その品種タグだけを挿入する（#166）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    expect(onPick.mock.calls).toEqual([["グラキリス"]]);
  });

  it("どの経路でもカテゴリ名（多肉植物 等）を onPick しない（#166）", async () => {
    const user = userEvent.setup();
    const { onPick } = renderPicker();
    // ドリルダウンで品種を選ぶ
    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));
    // 属を「このまま使う」
    await user.click(await screen.findByRole("button", { name: /#アガベ をこのまま使う/ }));
    const picked = onPick.mock.calls.map((c) => c[0]);
    expect(picked).not.toContain("多肉植物");
    expect(picked).not.toContain("塊根植物");
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

  it("インラインに出ていない定番（断水）は常時表示されず、「その他」を開くと見える（#169）", async () => {
    const user = userEvent.setup();
    renderPicker();
    // 断水 は世話の8番目以降＝インライン（先頭7件）には出ない
    expect(screen.queryByRole("button", { name: "#断水" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "世話のその他のタグ" }));
    const dialog = screen.getByRole("dialog", { name: "世話のタグ一覧" });
    expect(within(dialog).getByRole("button", { name: "#断水" })).toBeTruthy();
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

  it("追加リクエストリンクが github issues/new・labels=tagging で存在する（#169）", () => {
    renderPicker();
    const link = screen.getByRole("link", { name: /追加をリクエスト/ });
    const href = link.getAttribute("href")!;
    expect(href).toContain("https://github.com/kako-jun/hanoba/issues/new");
    expect(href).toContain("labels=tagging");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
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
