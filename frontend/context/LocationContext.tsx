import React, { createContext, useContext, useState, useEffect } from "react";
import * as Location from 'expo-location';

type LocationContextType = {
  location: Location.LocationObject | null;
  locationName: string;
  isLocating: boolean;
  hasAttemptedLocation: boolean;
  permissionGranted: boolean;
  refreshLocation: (force?: boolean) => Promise<void>;
};

const LocationContext = createContext<LocationContextType>({
  location: null,
  locationName: 'Locating...',
  isLocating: false,
  hasAttemptedLocation: false,
  permissionGranted: false,
  refreshLocation: async () => {},
});

export const useLocation = () => useContext(LocationContext);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationName, setLocationName] = useState("Locating...");
  const [isLocating, setIsLocating] = useState(true);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  const refreshLocation = async (force = false) => {
    const now = Date.now();
    // Use cached location if available and fresh enough
    if (!force && lastFetched > 0 && (now - lastFetched < CACHE_DURATION)) {
      console.log("Using cached location");
      return;
    }

    setIsLocating(true);
    setLocationName("Locating...");

    let hasLocation = false; // Track success locally within this run

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName("Permission Denied");
        setIsLocating(false);
        setHasAttemptedLocation(true);
        setPermissionGranted(false);
        return;
      }
      setPermissionGranted(true);

      // 1. Try Last Known Location first (Fast)
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
           setLocation(lastKnown);
           hasLocation = true;
           // Don't set lastFetched yet, wait for fresh
           // But update UI immediately
           // reverse geocode optional here for speed
        }
      } catch (e) {
        // Ignore last known error
      }

      // 2. Fetch Fresh Location
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      hasLocation = true;
      setLastFetched(Date.now());

      let address = await Location.reverseGeocodeAsync(loc.coords);
      if (address[0]) {
            const city = address[0].city || address[0].region || "Unknown City";
            const country = address[0].isoCountryCode || "";
            setLocationName(`${city}, ${country}`);
      } else {
            setLocationName("Current Location");
      }

    } catch (e) {
      console.log("Error fetching location", e);
      // If we failed to get current, but have last known (or existing state), preserve it
      if (!hasLocation && !location) {
          setLocationName("Location Unavailable");
      }
    } finally {
      setIsLocating(false);
      setHasAttemptedLocation(true);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    refreshLocation();
  }, []);

  return (
    <LocationContext.Provider value={{
      location,
      locationName,
      isLocating,
      hasAttemptedLocation,
      permissionGranted,
      refreshLocation
    }}>
      {children}
    </LocationContext.Provider>
  );
};
