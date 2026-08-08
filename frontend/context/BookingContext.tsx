import React, { createContext, useContext, useState, useEffect } from 'react';
import { Booking } from '../types';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface BookingContextType {
  myBookings: Booking[];
  bookingsError: string | null;
  fetchBookings: () => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const fetchBookings = async () => {
    if (!user?._id) return;
    // Customer booking list is only for end-users
    if (user.role === 'owner' || user.role === 'admin') {
      setMyBookings([]);
      setBookingsError(null);
      return;
    }
    try {
      const res = await api.get(`/bookings/user/${user._id}`);
      setMyBookings(res.data || []);
      setBookingsError(null);
    } catch (e) {
      if (__DEV__) console.log("Error fetching bookings", e);
      setBookingsError("Could not load bookings. Pull to refresh.");
    }
  };

  useEffect(() => {
    if (!user) {
      setMyBookings([]);
      setBookingsError(null);
      return;
    }
    fetchBookings();
  }, [user?._id, user?.role]);

  const cancelBooking = async (id: string) => {
    try {
      const res = await api.put(`/bookings/${id}/cancel`);

      const updated = myBookings.map(b =>
        // @ts-ignore
        b._id === id ? { ...b, status: 'cancelled' } : b
      );
      setMyBookings(updated);

      if (res.data?.walletCreditIssued > 0) {
        await refreshUser();
        showToast(
          res.data.walletCreditMessage ||
            `₹${res.data.walletCreditIssued} credited to your account`,
          'success',
        );
      } else {
        showToast('Booking has been cancelled', 'success');
      }
      fetchBookings();
    } catch (e: any) {
      if (__DEV__) console.log("Cancellation Error:", e);
      const msg = e.response?.data?.message || "Could not cancel booking. Please try again.";
      showToast(msg, 'error');
      throw e;
    }
  };

  return (
    <BookingContext.Provider value={{
      myBookings, bookingsError, fetchBookings, cancelBooking
    }}>
      {children}
    </BookingContext.Provider>
  );
}

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error("useBooking must be used within BookingProvider");
  return context;
};
