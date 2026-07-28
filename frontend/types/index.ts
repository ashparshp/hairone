export interface User {
  _id: string;
  phone: string;
  role: "user" | "owner" | "admin";
  name?: string;
  myShopId?: string | { _id: string };
  applicationStatus: "none" | "pending" | "approved" | "rejected" | "suspended";
  applicationSubmittedAt?: string;
  applicationReviewedAt?: string;
  applicationRejectionReason?: string;
  suspensionReason?: string;
  businessName?: string;
  partnerDraft?: {
    ownerName?: string;
    businessName?: string;
    shopName?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
    shopType?: "male" | "female" | "unisex";
    bufferTime?: number;
    minBookingNotice?: number;
    maxBookingNotice?: number;
    autoApproveBookings?: boolean;
    updatedAt?: string;
  };
  isPremium?: boolean;
  email?: string;
  favorites?: string[];
  gender?: string;
  avatar?: string;
}

export interface Service {
  _id: string;
  name: string;
  price: number;
  duration: number;
}

export interface Combo {
  _id: string;
  name: string;
  price: number;
  originalPrice: number;
  duration: number;
  items: string[]; // Service IDs
  isAvailable?: boolean;
}

export interface Shop {
  _id: string;
  name: string;
  address: string;
  image?: string;
  rating: number;
  services: Service[];
  combos?: Combo[];
}

export interface Barber {
  _id: string;
  name: string;
  avatar?: string;
  startHour: string;
  endHour: string;
  breaks?: { startTime: string; endTime: string; title: string }[];
}

export interface Booking {
  _id: string;
  userId: string | User;
  shopId: string | Shop;
  barberId: Barber;
  serviceNames: string[];
  totalPrice: number;
  totalDuration: number;
  date: string;
  startTime: string;
  endTime: string;
  status: "upcoming" | "completed" | "cancelled";
  bookingKey?: string;
  createdAt?: string;
}
