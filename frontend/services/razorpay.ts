import { Platform } from "react-native";

export interface RazorpayCheckoutResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CheckoutOptions {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
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
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill,
      theme: { color: "#f59e0b" },
      handler: (response: RazorpayCheckoutResult) => resolve(response),
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

  return RazorpayCheckout.open({
    key: options.keyId,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: options.prefill,
    theme: { color: "#f59e0b" },
  });
};
