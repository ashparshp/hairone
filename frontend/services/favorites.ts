import api from "./api";
import { Shop } from "../types";

export const getFavoriteShops = async (): Promise<Shop[]> => {
  const response = await api.get<Shop[]>("/shops/favorites");
  return response.data;
};

/** Toggle shop in favorites; returns updated favorite shop ID list. */
export const toggleFavoriteShop = async (shopId: string): Promise<string[]> => {
  const response = await api.post<string[]>("/auth/favorites", { shopId });
  return response.data;
};
