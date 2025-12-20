import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Shop, Service, Booking } from '../types';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface BookingContextType {
  selectedShop: Shop | null;
  setSelectedShop: (shop: Shop) => void;
  selectedServices: Service[];
  toggleService: (service: Service) => void;
  clearBooking: () => void;
  myBookings: Booking[];
  fetchBookings: () => void;
  cancelBooking: (id: string) => Promise<void>; // Updated to return Promise
}

const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);

  const toggleService = (service: Service) => {
    const exists = selectedServices.find(s => s.name === service.name);
    if (exists) {
      setSelectedServices(prev => prev.filter(s => s.name !== service.name));
    } else {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const clearBooking = () => {
    setSelectedServices([]);
    setSelectedShop(null);
  };

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
    fetchBookings();
  }, [user]);

  const cancelBooking = async (id: string) => {
    try {
      // 1. Call the API to update the server
      await api.put(`/bookings/${id}/cancel`);

      // 2. Optimistically update local state to reflect change immediately
      const updated = myBookings.map(b => 
        // @ts-ignore
        b._id === id ? { ...b, status: 'cancelled' } : b
      );
      // @ts-ignore
      setMyBookings(updated);

      Alert.alert("Success", "Booking has been cancelled");
      
      // 3. Re-fetch from server to ensure data consistency (removes from upcoming)
      fetchBookings();
      
    } catch (e) {
      console.log("Cancellation Error:", e);
      Alert.alert("Error", "Could not cancel booking. Please try again.");
    }
  };

  return (
    <BookingContext.Provider value={{
      selectedShop, setSelectedShop,
      selectedServices, toggleService,
      clearBooking,
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