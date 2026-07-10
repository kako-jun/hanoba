import { describe, expect, it } from "vitest";

import { hanobaWorkboxOptions } from "./workbox-options.mjs";

describe("hanobaWorkboxOptions", () => {
  it("does not rewrite static page navigations to the top page", () => {
    expect(hanobaWorkboxOptions.navigateFallback).toBeNull();
  });

  it("keeps query deep links matched to their precached page", () => {
    expect(hanobaWorkboxOptions.ignoreURLParametersMatching).toHaveLength(1);
    const [queryParameterPattern] = hanobaWorkboxOptions.ignoreURLParametersMatching;
    expect(queryParameterPattern).toBeInstanceOf(RegExp);
    expect(queryParameterPattern!.test("tags")).toBe(true);
    expect(queryParameterPattern!.test("q")).toBe(true);
    expect(queryParameterPattern!.test("p")).toBe(true);
  });
});
