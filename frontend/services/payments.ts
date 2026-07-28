import api from "./api";
import {
  BookingPaymentOrderResponse,
  RazorpayCheckoutResult,
  VerifyBookingPaymentResponse,
} from "../types/payment";

export interface BookingPaymentDraft {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createBookingPaymentOrder = async (
  draft: BookingPaymentDraft,
): Promise<BookingPaymentOrderResponse> => {
  const response = await api.post<BookingPaymentOrderResponse>(
    "/payments/create-booking-order",
    draft,
  );
  return response.data;
};

export const getPaymentOrder = async (paymentOrderId: string) => {
  const response = await api.get(`/payments/orders/${paymentOrderId}`);
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

export const verifyBookingPaymentWithRecovery = async (
  input: {
    paymentOrderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
  { maxAttempts = 3 } = {},
): Promise<VerifyBookingPaymentResponse> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await verifyBookingPayment(input);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1500 * attempt);
      }
    }
  }

  for (let poll = 0; poll < 5; poll += 1) {
    await sleep(2000);
    try {
      const order = await getPaymentOrder(input.paymentOrderId);
      if (order?.status === "PAID" && order?.bookingId) {
        return {
          paymentOrder: order,
          booking: null,
          duplicate: true,
        } as VerifyBookingPaymentResponse;
      }
      if (order?.status === "FAILED" && order?.failureReason?.includes("credited")) {
        throw new Error(order.failureReason);
      }
    } catch (pollError) {
      lastError = pollError;
    }
  }

  throw lastError;
};

export type { RazorpayCheckoutResult };
