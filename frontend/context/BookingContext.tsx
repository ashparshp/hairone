import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Booking } from '../types';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface BookingContextType {
  myBookings: Booking[];
  fetchBookings: () => void;
  cancelBooking: (id: string) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  const fetchBookings = async () => {
    // @ts-ignore
    if (!user?._id) return;
    try {
      // @ts-ignore
      const res = await api.get(`/bookings/user/${user._id}`);
      setMyBookings(res.data || []); 
    } catch (e) {
      console.log("Error fetching bookings", e);
      setMyBookings([]);
    }
  };

  useEffect(() => {
    if (!user) {
      setMyBookings([]);
      return;
    }
    fetchBookings();
  }, [user]);

  const cancelBooking = async (id: string) => {
    try {
      const res = await api.put(`/bookings/${id}/cancel`);

      const updated = myBookings.map(b => 
        // @ts-ignore
        b._id === id ? { ...b, status: 'cancelled' } : b
      );
      // @ts-ignore
      setMyBookings(updated);

      if (res.data?.walletCreditIssued > 0) {
        await refreshUser();
        Alert.alert(
          "Booking cancelled",
          res.data.walletCreditMessage ||
            `₹${res.data.walletCreditIssued} credited to your account`,
        );
      } else {
        Alert.alert("Success", "Booking has been cancelled");
      }
      fetchBookings();
      
    } catch (e: any) {
      console.log("Cancellation Error:", e);
      const msg = e.response?.data?.message || "Could not cancel booking. Please try again.";
      Alert.alert("Error", msg);
    }
  };

  return (
    <BookingContext.Provider value={{
      myBookings, fetchBookings, cancelBooking
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
