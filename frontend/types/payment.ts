export type PaymentOrderStatus =
  | "created"
  | "processing"
  | "paid"
  | "expired"
  | "failed";

export interface PaymentOrderDto {
  id: string;
  referenceId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  status: PaymentOrderStatus;
  expiresAt: string;
  bookingId: string | null;
  failureReason?: string | null;
}

export interface CheckoutSessionDto {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  referenceId: string;
}

export interface BookingPaymentOrderResponse {
  paymentOrder: PaymentOrderDto;
  checkout: CheckoutSessionDto;
  summary: {
    shopName: string;
    finalPrice: number;
    originalPrice: number;
    discountAmount: number;
    walletCreditApplied?: number;
    amountDue?: number;
  };
  reused?: boolean;
  walletOnly?: boolean;
  booking?: unknown;
}

export interface VerifyBookingPaymentResponse {
  message: string;
  paymentOrder: PaymentOrderDto;
  booking?: unknown;
  bookingId?: string;
  duplicate?: boolean;
}

export interface GetPaymentOrderResponse {
  paymentOrder: PaymentOrderDto;
}

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
