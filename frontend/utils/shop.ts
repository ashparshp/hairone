import { User } from "../types";

/** Normalize `user.myShopId` whether it is a string or populated `{ _id }`. */
export function getMyShopId(
  user: Pick<User, "myShopId"> | null | undefined,
): string | null {
  const raw = user?.myShopId;
  if (!raw) return null;
  if (typeof raw === "object") {
    return raw._id ? String(raw._id) : null;
  }
  return String(raw);
}

/** Admin route param takes precedence; otherwise owner's shop id. */
export function getTargetShopId(
  user: Pick<User, "myShopId"> | null | undefined,
  paramShopId?: string | string[] | null,
): string | null {
  if (paramShopId != null && paramShopId !== "") {
    return Array.isArray(paramShopId) ? paramShopId[0] || null : paramShopId;
  }
  return getMyShopId(user);
}
