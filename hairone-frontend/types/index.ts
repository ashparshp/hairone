export interface User {
  _id: string;
  phone: string;
  role: "user" | "owner" | "admin";
  name?: string;
  myShopId?: string;
  applicationStatus: "none" | "pending" | "approved" | "rejected";
  businessName?: string;
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

export interface Shop {
  _id: string;
  name: string;
  address: string;
  image?: string;
  rating: number;
  services: Service[];
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
