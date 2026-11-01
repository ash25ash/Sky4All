import { describe, expect, it } from "vitest";
import { cartTotalCents, products } from "@/lib/menu";

describe("Passenger menu", () => {
  it("contains exactly 40 distinct products", () => {
    expect(products).toHaveLength(40);
    expect(new Set(products.map((p) => p.name)).size).toBe(40);
  });

  it("gives every product a positive price in cents", () => {
    expect(products.every((p) => Number.isInteger(p.priceCents) && p.priceCents > 0)).toBe(true);
  });

  it("totals selected quantities using their unit prices", () => {
    expect(cartTotalCents({ "Coca-Cola Original": 2, "Red Bull Original": 1 })).toBe(1050);
    expect(cartTotalCents({})).toBe(0);
  });
});