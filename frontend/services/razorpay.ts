import { Platform } from "react-native";
import { RazorpayCheckoutResult } from "../types/payment";

interface CheckoutOptions {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  referenceId: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
}

const loadRazorpayWebScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay web checkout is unavailable"));
      return;
    }

    if ((window as any).Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });

const openRazorpayWebCheckout = async (
  options: CheckoutOptions,
): Promise<RazorpayCheckoutResult> => {
  await loadRazorpayWebScript();

  return new Promise((resolve, reject) => {
    const Razorpay = (window as any).Razorpay;
    const checkout = new Razorpay({
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      notes: { referenceId: options.referenceId },
      prefill: options.prefill,
      theme: { color: "#f59e0b" },
      handler: (response: RazorpayCheckoutResult) => {
        if (
          !response?.razorpay_payment_id ||
          !response?.razorpay_order_id ||
          !response?.razorpay_signature
        ) {
          reject(new Error("Incomplete payment response"));
          return;
        }
        resolve(response);
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
    });

    checkout.open();
  });
};

export const openRazorpayCheckout = async (
  options: CheckoutOptions,
): Promise<RazorpayCheckoutResult> => {
  if (Platform.OS === "web") {
    return openRazorpayWebCheckout(options);
  }

  const RazorpayCheckout = require("react-native-razorpay").default;
  try {
    const result = await RazorpayCheckout.open({
      key: options.keyId,
      amount: options.amountPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      notes: { referenceId: options.referenceId },
      prefill: options.prefill,
      theme: { color: "#f59e0b" },
    });

    if (
      !result?.razorpay_payment_id ||
      !result?.razorpay_order_id ||
      !result?.razorpay_signature
    ) {
      throw new Error("Incomplete payment response");
    }

    return result;
  } catch (error: any) {
    if (error?.code === 0 || error?.code === 2) {
      throw new Error("Payment cancelled");
    }
    if (typeof error?.description === "string" && /cancel/i.test(error.description)) {
      throw new Error("Payment cancelled");
    }
    throw error;
  }
};
