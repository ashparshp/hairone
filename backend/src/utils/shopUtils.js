/**
 * Normalize myShopId whether it is an ObjectId, string, or populated Shop doc.
 */
const resolveMyShopId = (value) => {
  if (value == null) return null;
  if (typeof value === "object" && value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const userOwnsShop = (user, shopId) => {
  const owned = resolveMyShopId(user?.myShopId);
  if (!owned || shopId == null) return false;
  return owned === shopId.toString();
};

module.exports = {
  resolveMyShopId,
  userOwnsShop,
};
