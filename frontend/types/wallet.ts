export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  reason: string;
  reasonLabel: string;
  note: string | null;
  createdAt: string;
}

export interface WalletHistoryResponse {
  balance: number;
  transactions: WalletTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
