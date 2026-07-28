import api from "./api";
import { WalletHistoryResponse } from "../types/wallet";

export const getWalletHistory = async (
  page = 1,
  limit = 50,
): Promise<WalletHistoryResponse> => {
  const response = await api.get<WalletHistoryResponse>("/wallet", {
    params: { page, limit },
  });
  return response.data;
};
