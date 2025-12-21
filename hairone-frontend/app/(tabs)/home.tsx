import React, { useCallback, useState, useEffect } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Search, MapPin, Filter, Sun, Moon, AlertCircle } from "lucide-react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform
} from "react-native";
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';

import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ShopCard } from "../../components/ShopCard";
import api from "../../services/api";

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'hair', label: 'Haircut' },
  { id: 'beard', label: 'Beard' },
  { id: 'facial', label: 'Facial' },
  { id: 'spa', label: 'Spa' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [genderFilter, setGenderFilter] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState(10); // Default 10km (max)

  // Location State
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationName, setLocationName] = useState("Locating...");
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Initial Location Fetch
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName("Permission Denied");
        return;
      }
      setPermissionGranted(true);

      try {
        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        setLocationName("Current Location");

        // Optional: Reverse geocoding to get city name
        // let address = await Location.reverseGeocodeAsync(loc.coords);
        // if (address[0]?.city) setLocationName(`${address[0].city}, ${address[0].isoCountryCode}`);

      } catch (e) {
        setLocationName("Location Unavailable");
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [location, distanceFilter, genderFilter, activeCategory])
  );

  const fetchShops = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Basic Filters
      if (activeCategory !== 'all') params.append('category', activeCategory); // Backend might not support category search yet, using text search for now or type

      // If Gender Filter is active (mapping UI 'Men' -> API 'male')
      if (genderFilter !== 'All') {
          const typeMap: any = { 'Men': 'male', 'Women': 'female', 'Unisex': 'unisex' };
          params.append('type', typeMap[genderFilter] || 'all');
      }

      // Location & Distance
      if (location) {
          params.append('lat', location.coords.latitude.toString());
          params.append('lng', location.coords.longitude.toString());
          params.append('radius', distanceFilter.toString());
      }

      // Note: 'minTime' logic from previous version omitted for clarity, can be re-added if needed.

      const res = await api.get(`/shops?${params.toString()}`);

      // Client-side text filtering if API doesn't support search q
      // Also Client-side Category filtering if backend doesn't support 'category' param yet
      // Assuming backend 'type' covers gender.
      // For service categories (Hair, Beard), we might need to filter by service names.
      // Since backend doesn't filter by service tags yet, let's filter client side for 'Category'

      let fetchedShops = res.data;

      // Text Search Filter
      if (searchText) {
          fetchedShops = fetchedShops.filter((s: any) =>
            s.name.toLowerCase().includes(searchText.toLowerCase()) ||
            s.address.toLowerCase().includes(searchText.toLowerCase())
          );
      }

      // Category Filter (Mock logic: checking if services include keyword)
      // This requires shop.services populated.
      // Backend 'getAllShops' might not populate services deeply or we rely on tags.
      // For now, if activeCategory != all, we filter by service name.
      if (activeCategory !== 'all') {
         fetchedShops = fetchedShops.filter((s: any) =>
            s.services?.some((svc: any) => svc.name.toLowerCase().includes(activeCategory.toLowerCase()))
         );
      }

      setShops(fetchedShops);

    } catch (e) {
      console.log("Error fetching shops:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchShops();
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.locationRow}>
             <MapPin size={14} color="#f59e0b" fill="#f59e0b" />
             <Text style={[styles.locationText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
               {locationName}
             </Text>
          </View>
          <Text style={[styles.greeting, { color: isDark ? 'white' : '#0f172a' }]}>
            Hello, {user?.name?.split(' ')[0] || "Guest"}
          </Text>
        </View>

        <View style={styles.headerRight}>
             <TouchableOpacity
               onPress={toggleTheme}
               style={[
                 styles.themeToggle,
                 {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? '#334155' : '#e2e8f0'
                 }
               ]}
             >
               <View style={[
                 styles.themeIconContainer,
                 {
                    transform: [{ translateX: isDark ? 14 : 0 }],
                    backgroundColor: isDark ? '#475569' : 'white'
                 }
               ]}>
                  {isDark ? <Moon size={10} color="#fcd34d" /> : <Sun size={10} color="#f59e0b" />}
               </View>
             </TouchableOpacity>

            <View style={[styles.avatarContainer, { borderColor: isDark ? '#334155' : 'white' }]}>
              <Image
                source={{ uri: 'https://via.placeholder.com/100' }} // Replace with user.avatar
                style={styles.avatar}
              />
            </View>
        </View>
      </View>

      {/* Main Scroll Content */}
      <FlatList
        data={shops}
        keyExtractor={(item: any) => item._id}
        renderItem={({ item, index }) => (
          <ShopCard
            shop={item}
            index={index}
            onPress={() => router.push(`/salon/${item._id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            {/* Search Bar */}
            <View style={styles.searchSection}>
              <View style={[styles.searchBox, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#f1f5f9' }]}>
                <Search size={18} color={isDark ? '#94a3b8' : '#cbd5e1'} />
                <TextInput
                  placeholder="Find a salon or service..."
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={[styles.input, { color: isDark ? 'white' : '#0f172a' }]}
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={() => fetchShops()}
                />
                <TouchableOpacity
                  onPress={() => setShowFilters(!showFilters)}
                  style={[styles.filterBtn, showFilters && { backgroundColor: '#f59e0b' }]}
                >
                  <Filter size={18} color={showFilters ? 'white' : (isDark ? '#94a3b8' : '#cbd5e1')} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Collapsible Filters */}
            {showFilters && (
              <View style={[styles.filterContainer, { backgroundColor: isDark ? '#1e293b' : 'white', borderColor: isDark ? '#334155' : '#f1f5f9' }]}>

                {/* Gender Filter */}
                <View style={styles.filterGroup}>
                  <Text style={[styles.filterLabel, { color: isDark ? '#94a3b8' : '#cbd5e1' }]}>Gender</Text>
                  <View style={styles.chipRow}>
                    {['All', 'Men', 'Women', 'Unisex'].map(g => (
                      <TouchableOpacity
                        key={g}
                        onPress={() => setGenderFilter(g)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: genderFilter === g ? '#f59e0b' : (isDark ? '#334155' : '#f8fafc'),
                            borderColor: isDark ? '#475569' : '#e2e8f0'
                          }
                        ]}
                      >
                        <Text style={[
                          styles.chipText,
                          { color: genderFilter === g ? 'white' : (isDark ? '#cbd5e1' : '#64748b') }
                        ]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Distance Filter */}
                <View style={styles.filterGroup}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                     <Text style={[styles.filterLabel, { color: isDark ? '#94a3b8' : '#cbd5e1' }]}>Distance</Text>
                     <Text style={{color: '#f59e0b', fontWeight: 'bold', fontSize: 12}}>
                        {distanceFilter === 10 ? 'All' : `< ${distanceFilter} km`}
                     </Text>
                  </View>
                  <Slider
                    style={{width: '100%', height: 40}}
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    value={distanceFilter}
                    onValueChange={setDistanceFilter}
                    minimumTrackTintColor="#f59e0b"
                    maximumTrackTintColor={isDark ? "#334155" : "#e2e8f0"}
                    thumbTintColor="#f59e0b"
                  />
                </View>

              </View>
            )}

            {/* Categories */}
            <View style={styles.categoriesSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 20}}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setActiveCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: activeCategory === cat.id
                           ? (isDark ? '#f59e0b' : '#0f172a')
                           : (isDark ? '#1e293b' : '#ffffff'),
                        borderColor: isDark ? '#334155' : '#e2e8f0'
                      }
                    ]}
                  >
                    <Text style={[
                      styles.catText,
                      { color: activeCategory === cat.id ? (isDark ? '#0f172a' : 'white') : (isDark ? '#94a3b8' : '#64748b') }
                    ]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.listHeader}>
              <Text style={[styles.heading, { color: isDark ? 'white' : '#0f172a' }]}>Nearby Salons</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>No salons found nearby.</Text>
            </View>
          )
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeToggle: {
    width: 56,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    padding: 2,
    justifyContent: 'center',
  },
  themeIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },

  // Search
  searchSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filterBtn: {
    padding: 6,
    borderRadius: 8,
  },

  // Filters
  filterContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Categories
  categoriesSection: {
    marginBottom: 24,
  },
  catChip: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  catText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  listHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 100, // Space for bottom nav
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    opacity: 0.7
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  }

});
