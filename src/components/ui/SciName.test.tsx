import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SciName from "./SciName.tsx";

describe("SciName (#70)", () => {
  it("属名・種小名はイタリック、var. は直立体にする", () => {
    const { container } = render(<SciName sci="Pachypodium rosulatum var. gracilius" />);
    const spans = [...container.querySelectorAll("span > span")];
    const find = (text: string) => spans.find((s) => s.textContent === text);
    expect(find("Pachypodium")?.className).toContain("italic");
    expect(find("Pachypodium")?.className).not.toContain("not-italic");
    expect(find("rosulatum")?.className).toContain("italic");
    expect(find("gracilius")?.className).toContain("italic");
    // var. は直立体。
    expect(find("var.")?.className).toBe("not-italic");
  });

  it("subsp./f./cv./aff./cf. と交配の × も直立体にする", () => {
    const { container } = render(<SciName sci="Genus species subsp. sub f. forma cv. Foo aff. bar cf. baz × hybrid" />);
    const spans = [...container.querySelectorAll("span > span")];
    const cls = (text: string) => spans.find((s) => s.textContent === text)?.className;
    for (const upright of ["subsp.", "f.", "cv.", "aff.", "cf.", "×"]) {
      expect(cls(upright), `${upright} は直立`).toBe("not-italic");
    }
    expect(cls("Genus")).toContain("italic");
    expect(cls("hybrid")).toContain("italic");
  });

  it("外側 span に className を渡す", () => {
    const { container } = render(<SciName sci="Aloe vera" className="font-display text-x" />);
    const outer = container.firstElementChild;
    expect(outer?.className).toBe("font-display text-x");
  });

  it("表示テキストは元の学名と一致する（空白も保持）", () => {
    const sci = "Pachypodium rosulatum var. gracilius";
    const { container } = render(<SciName sci={sci} />);
    expect(container.textContent).toBe(sci);
  });
});
