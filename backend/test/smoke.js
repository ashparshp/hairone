/**
 * CI smoke: pure utils + tiny assertions (no Mongo / HTTP).
 */
const assert = require("assert");
const {
  normalizeIndianPhone,
  phoneLookupVariants,
} = require("../src/utils/phoneUtils");
const { resolveMyShopId, userOwnsShop } = require("../src/utils/shopUtils");
const { getISTTime } = require("../src/utils/dateUtils");

assert.strictEqual(normalizeIndianPhone("+919876543210"), "9876543210");
assert.strictEqual(normalizeIndianPhone("09876543210"), "9876543210");
assert.ok(phoneLookupVariants("9876543210").includes("9876543210"));

assert.strictEqual(resolveMyShopId({ _id: "abc123" }), "abc123");
assert.strictEqual(
  userOwnsShop({ myShopId: "shop1" }, "shop1"),
  true,
);
assert.strictEqual(
  userOwnsShop({ myShopId: "shop1" }, "shop2"),
  false,
);

const ist = getISTTime();
assert.ok(ist && typeof ist.date === "string");

console.log("Smoke OK — phone, shop, date utils");
