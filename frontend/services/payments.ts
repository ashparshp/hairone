import api from "./api";
import {
  BookingPaymentOrderResponse,
  GetPaymentOrderResponse,
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

export const getPaymentOrder = async (
  paymentOrderId: string,
): Promise<GetPaymentOrderResponse> => {
  const response = await api.get<GetPaymentOrderResponse>(
    `/payments/orders/${paymentOrderId}`,
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
      const { paymentOrder } = await getPaymentOrder(input.paymentOrderId);
      if (paymentOrder?.status === "paid" && paymentOrder?.bookingId) {
        return {
          message: "Payment already confirmed",
          paymentOrder,
          bookingId: paymentOrder.bookingId,
          duplicate: true,
        };
      }
      if (
        paymentOrder?.status === "failed" &&
        paymentOrder?.failureReason?.includes("credited")
      ) {
        throw new Error(paymentOrder.failureReason);
      }
    } catch (pollError) {
      if (
        pollError instanceof Error &&
        pollError.message.includes("credited")
      ) {
        throw pollError;
      }
      lastError = pollError;
    }
  }

  throw lastError;
};

export type { RazorpayCheckoutResult };
