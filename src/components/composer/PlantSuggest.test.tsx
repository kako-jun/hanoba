import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlantSuggest from "./PlantSuggest.tsx";

describe("PlantSuggest", () => {
  afterEach(() => cleanup());

  it("俗称を書くと正規形タグの候補（学名つき）を出す", () => {
    render(<PlantSuggest caption="うちのパキポ かわいい" onAddTag={() => {}} />);
    expect(screen.getByText("＋ #パキポディウム")).toBeInTheDocument();
    // 学名を表示（SciName で属名/種小名はイタリック・接続語は直立・#70）。
    // 属チップ（sci=Pachypodium）と子チップ（グラキリス sci=Pachypodium rosulatum …）の
    // 両方が先頭トークン "Pachypodium" を leaf span に持つため getAllByText で見る。
    expect(screen.getAllByText("Pachypodium").length).toBeGreaterThan(0);
  });

  it("タップで正規形（最も有名な表記）を渡す", async () => {
    const user = userEvent.setup();
    const onAddTag = vi.fn();
    render(<PlantSuggest caption="パキポ育成中" onAddTag={onAddTag} />);
    await user.click(screen.getByRole("button", { name: /パキポディウム/ }));
    expect(onAddTag).toHaveBeenCalledWith("パキポディウム");
  });

  it("属タグが付いていれば本体は出さず、子で具体化できる（多段・#63）", () => {
    render(<PlantSuggest caption="パキポ #パキポディウム" onAddTag={() => {}} />);
    // 属本体（＋ #パキポディウム）はもう出さない。
    expect(screen.queryByText(/＋ #パキポディウム/)).not.toBeInTheDocument();
    // が、「さらに具体的にできます」で子（グラキリス）を出す。
    expect(screen.getByText("さらに具体的にできます")).toBeInTheDocument();
    expect(screen.getByText("＋ #グラキリス")).toBeInTheDocument();
  });

  it("属を認識したら子（さらに具体的にできます）も提示する（#63）", () => {
    render(<PlantSuggest caption="パキポ かわいい" onAddTag={() => {}} />);
    expect(screen.getByText("＋ #パキポディウム")).toBeInTheDocument();
    expect(screen.getByText("さらに具体的にできます")).toBeInTheDocument();
    expect(screen.getByText("＋ #グラキリス")).toBeInTheDocument();
  });

  it("子タップで具体タグ（グラキリス）を渡す（#63）", async () => {
    const user = userEvent.setup();
    const onAddTag = vi.fn();
    render(<PlantSuggest caption="パキポ #パキポディウム" onAddTag={onAddTag} />);
    await user.click(screen.getByRole("button", { name: /グラキリス/ }));
    expect(onAddTag).toHaveBeenCalledWith("グラキリス");
  });

  it("属も子もすべて付いていれば何も出さない", () => {
    const { container } = render(
      <PlantSuggest caption="パキポ #パキポディウム #グラキリス" onAddTag={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("植物が無ければ何も出さない", () => {
    const { container } = render(<PlantSuggest caption="ただのメモ" onAddTag={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
