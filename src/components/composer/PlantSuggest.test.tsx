import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlantSuggest from "./PlantSuggest.tsx";

describe("PlantSuggest", () => {
  afterEach(() => cleanup());

  it("俗称を書くと正規形タグの候補（学名つき）を出す", () => {
    render(<PlantSuggest caption="うちのパキポ かわいい" onAddTag={() => {}} />);
    expect(screen.getByText("＋ #パキポディウム")).toBeInTheDocument();
    expect(screen.getByText("Pachypodium")).toBeInTheDocument();
  });

  it("タップで正規形（最も有名な表記）を渡す", async () => {
    const user = userEvent.setup();
    const onAddTag = vi.fn();
    render(<PlantSuggest caption="パキポ育成中" onAddTag={onAddTag} />);
    await user.click(screen.getByRole("button", { name: /パキポディウム/ }));
    expect(onAddTag).toHaveBeenCalledWith("パキポディウム");
  });

  it("既に正規タグが付いていれば候補に出さない", () => {
    const { container } = render(
      <PlantSuggest caption="パキポ #パキポディウム" onAddTag={() => {}} />,
    );
    expect(screen.queryByText(/＋ #パキポディウム/)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("植物が無ければ何も出さない", () => {
    const { container } = render(<PlantSuggest caption="ただのメモ" onAddTag={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
