import { describe, it, expect } from "vitest";
import { capitalize } from "./utils.js";

describe("capitalize", () => {
  it("uppercases the first letter", () => {
    expect(capitalize("pikachu")).toBe("Pikachu");
  });

  it("leaves an already-capitalized string unchanged", () => {
    expect(capitalize("Pikachu")).toBe("Pikachu");
  });

  it("coerces non-string input", () => {
    expect(capitalize(123)).toBe("123");
  });
});
