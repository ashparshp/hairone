import api from "./api";
import {
  BookingPaymentOrderResponse,
  RazorpayCheckoutResult,
  VerifyBookingPaymentResponse,
} from "../types/payment";

export interface BookingPaymentDraft {
  userId?: string;
  shopId: string;
  barberId: string;
  serviceNames: string[];
  totalPrice: number;
  totalDuration: number;
  date: string;
  startTime: string;
  bookingMode: string;
  applyWalletCredit?: boolean;
}

export const createBookingPaymentOrder = async (
  draft: BookingPaymentDraft,
): Promise<BookingPaymentOrderResponse> => {
  const response = await api.post<BookingPaymentOrderResponse>(
    "/payments/create-booking-order",
    draft,
  );
  return response.data;
};

export const verifyBookingPayment = async (input: {
  paymentOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyBookingPaymentResponse> => {
  const response = await api.post<VerifyBookingPaymentResponse>(
    "/payments/verify-booking",
    input,
  );
  return response.data;
};

export type { RazorpayCheckoutResult };
