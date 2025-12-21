import { useFocusEffect, useRouter } from "expo-router";
import {
  MapPin,
  Search,
  Star,
  Clock,
  Filter,
  Moon,
  Sun,
  Scissors,
  User,
  Heart,
  ChevronDown,
  Check
} from "lucide-react-native";
import React, { useCallback, useState, useEffect } from "react";
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
  Platform,
  LayoutAnimation,
  UIManager
} from "react-native";
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { FadeInView } from "../../components/AnimatedViews";
import { ScalePress } from "../../components/ScalePress";
import api from "../../services/api";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width } = Dimensions.get('window');

// Haversine formula
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return parseFloat(d.toFixed(1)); // Return number
}

const deg2rad = (deg: number) => deg * (Math.PI/180);

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();

  // Data State
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [genderFilter, setGenderFilter] = useState('All');
  const [distanceFilter, setDistanceFilter] = useState(10); // Max 10km default

  // Location State
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentAddress, setCurrentAddress] = useState("Locating...");

  // Setup Location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentAddress("Location Denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });

      // Reverse Geocode for Header
      try {
          let address = await Location.reverseGeocodeAsync(location.coords);
          if (address.length > 0) {
             const city = address[0].city || address[0].subregion || "Unknown City";
             const region = address[0].region || address[0].country || "";
             setCurrentAddress(`${city}, ${region}`);
          }
      } catch (e) {
          setCurrentAddress("Current Location");
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [])
  );

  const fetchShops = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/shops`); // Fetch all, filter client side for smooth demo
      setShops(res.data);
    } catch (e) {
      console.log("Error fetching shops:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowFilters(!showFilters);
  }

  // Categories
  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Hair', label: 'Haircut' },
    { id: 'Beard', label: 'Beard' },
    { id: 'Facial', label: 'Facial' },
    { id: 'Spa', label: 'Spa' },
  ];

  // Filter Logic
  const filteredShops = shops.filter((s: any) => {
    // 1. Search Text
    if (searchText && !s.name.toLowerCase().includes(searchText.toLowerCase()) && !s.address?.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
    }

    // 2. Gender
    if (genderFilter !== 'All') {
        const targetType = genderFilter === 'Men' ? 'male' : genderFilter === 'Women' ? 'female' : 'unisex';
        if (s.type.toLowerCase() !== targetType) return false;
    }

    // 3. Category (Check services)
    if (activeCategory !== 'All') {
        // Mock checking services or just type for demo if services empty
        // Assuming s.services exists
        const hasService = s.services?.some((srv: any) => srv.name.toLowerCase().includes(activeCategory.toLowerCase()));
        if (!hasService && activeCategory !== 'All') {
             // Fallback: If no services, maybe match 'Hair' to 'male' type?
             // Ideally we strictly check services.
             // For demo, if services empty, we might skip or show all?
             // Let's return false if services exist but don't match.
             if (s.services && s.services.length > 0) return false;
        }
    }

    // 4. Distance
    if (userLocation && s.coordinates?.lat) {
        const dist = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, s.coordinates.lat, s.coordinates.lng);
        if (dist > distanceFilter) return false;
    }

    return true;
  });

  const renderShop = ({ item, index }: { item: any, index: number }) => {
    let distance = null;
    if (userLocation && item.coordinates?.lat) {
        distance = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, item.coordinates.lat, item.coordinates.lng);
    }

    // Tags generation
    const tags = [];
    if (item.type === 'male') tags.push("Barber");
    if (item.type === 'female') tags.push("Salon");
    if (item.type === 'unisex') tags.push("Unisex");
    if (item.services?.length > 0) {
        tags.push(item.services[0].name.split(' ')[0]);
    } else {
        tags.push("Haircut");
    }
    const displayTags = tags.slice(0, 3); // Max 3

    return (
    <FadeInView delay={index * 100}>
        <ScalePress
            style={[
                styles.card,
                {
                    backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
                    borderColor: theme === 'dark' ? '#334155' : '#f1f5f9',
                    shadowColor: theme === 'dark' ? '#000' : '#e2e8f0'
                }
            ]}
            onPress={() => router.push(`/salon/${item._id}`)}
        >
            {/* Image Section */}
            <View style={styles.cardImageContainer}>
                <Image
                    source={{ uri: item.image || 'https://via.placeholder.com/400' }}
                    style={styles.cardImage}
                    resizeMode="cover"
                />
                <TouchableOpacity style={styles.heartBtn}>
                    <Heart size={14} color="white" />
                </TouchableOpacity>
            </View>

            {/* Info Section */}
            <View style={styles.cardContent}>
                <View style={styles.rowBetweenStart}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.rowMuted}>
                            <MapPin size={10} color={colors.textMuted} />
                            <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>
                                {item.address} {distance ? `• ${distance} km` : ''}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.ratingBadge, { backgroundColor: theme === 'dark' ? '#334155' : '#f1f5f9' }]}>
                        <Star size={10} color="#fbbf24" fill="#fbbf24" />
                        <Text style={[styles.ratingText, { color: colors.text }]}>{item.rating || '5.0'}</Text>
                    </View>
                </View>

                {/* Tags */}
                <View style={styles.tagRow}>
                    {displayTags.map((tag, i) => (
                        <View key={i} style={[styles.tag, { backgroundColor: theme === 'dark' ? '#334155' : '#f3f4f6' }]}>
                            <Text style={[styles.tagText, { color: theme === 'dark' ? '#cbd5e1' : '#4b5563' }]}>{tag}</Text>
                        </View>
                    ))}
                </View>

                {/* Bottom Action */}
                <View style={[styles.actionRow, { borderColor: colors.border }]}>
                     <View style={styles.rowGap}>
                         <View style={[styles.iconCircle, { backgroundColor: theme === 'dark' ? '#334155' : '#fffbeb' }]}>
                             <Clock size={12} color={colors.tint} />
                         </View>
                         <View>
                             <Text style={[styles.tinyLabel, { color: colors.textMuted }]}>NEXT SLOT</Text>
                             <Text style={[styles.slotVal, { color: colors.text }]}>{item.nextAvailableSlot || 'Full Today'}</Text>
                         </View>
                     </View>
                     <TouchableOpacity
                        style={[styles.bookBtn, { backgroundColor: theme === 'dark' ? colors.tint : '#0f172a' }]}
                        onPress={() => router.push(`/salon/${item._id}`)}
                     >
                         <Text style={[styles.bookBtnText, { color: theme === 'dark' ? '#0f172a' : 'white' }]}>Book Now</Text>
                     </TouchableOpacity>
                </View>
            </View>
        </ScalePress>
    </FadeInView>
  )};

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* HEADER */}
      <View style={styles.header}>
         <View style={{flex: 1}}>
             <View style={styles.locationRow}>
                 <MapPin size={14} color={colors.tint} fill={colors.tint} />
                 <Text style={[styles.locationText, { color: colors.textMuted }]}>{currentAddress}</Text>
                 <ChevronDown size={12} color={colors.textMuted} />
             </View>
             <Text style={[styles.greeting, { color: colors.text }]}>Hello, {user?.name?.split(' ')[0] || "Guest"}</Text>
         </View>

         <View style={styles.headerRight}>
             {/* Animated Switch */}
             <TouchableOpacity onPress={toggleTheme} activeOpacity={0.8} style={[styles.themeSwitch, { backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0' }]}>
                 <View style={[styles.switchKnob, {
                     transform: [{ translateX: theme === 'dark' ? 32 : 0 }],
                     backgroundColor: theme === 'dark' ? '#0f172a' : 'white'
                 }]}>
                     {theme === 'dark' ? <Moon size={12} color={colors.tint} /> : <Sun size={12} color={colors.tint} />}
                 </View>
                 <View style={styles.switchIconLeft}><Sun size={12} color="#94a3b8" /></View>
                 <View style={styles.switchIconRight}><Moon size={12} color="#94a3b8" /></View>
             </TouchableOpacity>

             <View style={styles.avatarContainer}>
                 <Text style={{fontSize: 14, fontWeight: 'bold'}}>{user?.name?.[0] || 'U'}</Text>
             </View>
         </View>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
          <View style={[styles.searchPill, { backgroundColor: theme === 'dark' ? '#1e293b' : 'white', borderColor: colors.border }]}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Find a salon or service..."
                  placeholderTextColor={colors.textMuted}
                  value={searchText}
                  onChangeText={setSearchText}
              />
              <TouchableOpacity onPress={toggleFilters} style={[styles.filterBtn, showFilters && { backgroundColor: colors.tint }]}>
                  <Filter size={16} color={showFilters ? (theme === 'dark' ? 'black' : 'white') : colors.textMuted} />
              </TouchableOpacity>
          </View>
      </View>

      {/* EXPANDABLE FILTERS */}
      {showFilters && (
          <View style={[styles.filtersBox, { backgroundColor: theme === 'dark' ? '#1e293b' : 'white', borderColor: colors.border }]}>
              {/* Gender */}
              <View style={{marginBottom: 16}}>
                  <Text style={[styles.filterLabel, { color: colors.textMuted }]}>GENDER</Text>
                  <View style={{flexDirection: 'row', gap: 8}}>
                      {['All', 'Men', 'Women', 'Unisex'].map(g => (
                          <TouchableOpacity
                            key={g}
                            style={[
                                styles.genderChip,
                                { borderColor: colors.border },
                                genderFilter === g && { backgroundColor: colors.tint, borderColor: colors.tint }
                            ]}
                            onPress={() => setGenderFilter(g)}
                          >
                              <Text style={[
                                  styles.genderText,
                                  { color: colors.textMuted },
                                  genderFilter === g && { color: theme === 'dark' ? 'black' : 'white', fontWeight: 'bold' }
                              ]}>{g}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
              </View>

              {/* Distance Slider */}
              <View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                      <Text style={[styles.filterLabel, { color: colors.textMuted }]}>DISTANCE</Text>
                      <Text style={{fontSize: 12, fontWeight: 'bold', color: colors.tint}}>
                          {distanceFilter === 10 ? 'Any' : `< ${distanceFilter} km`}
                      </Text>
                  </View>
                  <Slider
                      style={{width: '100%', height: 40}}
                      minimumValue={1}
                      maximumValue={10}
                      step={1}
                      value={distanceFilter}
                      onValueChange={setDistanceFilter}
                      minimumTrackTintColor={colors.tint}
                      maximumTrackTintColor={colors.border}
                      thumbTintColor={colors.tint}
                  />
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <Text style={{fontSize: 10, color: colors.textMuted}}>1 km</Text>
                      <Text style={{fontSize: 10, color: colors.textMuted}}>10 km</Text>
                  </View>
              </View>
          </View>
      )}

      {/* CATEGORIES */}
      <View style={{marginBottom: 20}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 20}}>
              {categories.map(cat => (
                  <TouchableOpacity
                      key={cat.id}
                      style={[
                          styles.catChip,
                          {
                            backgroundColor: activeCategory === cat.id ? (theme === 'dark' ? '#f1f5f9' : '#0f172a') : (theme === 'dark' ? '#1e293b' : 'white'),
                            borderColor: colors.border
                          }
                      ]}
                      onPress={() => setActiveCategory(cat.id)}
                  >
                      <Text style={[
                          styles.catText,
                          { color: activeCategory === cat.id ? (theme === 'dark' ? '#0f172a' : 'white') : colors.textMuted }
                      ]}>{cat.label}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      {/* LIST HEADER */}
      <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.text }]}>Nearby ({filteredShops.length})</Text>
          <TouchableOpacity><Text style={{fontSize: 12, color: colors.textMuted}}>View Map</Text></TouchableOpacity>
      </View>

      {/* SHOP LIST */}
      {loading ? (
        <ActivityIndicator style={{marginTop: 40}} color={colors.tint} />
      ) : (
        <FlatList
            data={filteredShops}
            renderItem={renderShop}
            keyExtractor={(item: any) => item._id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
                <Text style={{textAlign: 'center', marginTop: 40, color: colors.textMuted}}>No salons found nearby.</Text>
            }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 20 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  locationText: { fontSize: 12, fontWeight: '600' },
  greeting: { fontSize: 24, fontWeight: 'bold' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  themeSwitch: { width: 64, height: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', position: 'relative', paddingHorizontal: 4 },
  switchKnob: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 4, left: 4, zIndex: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  switchIconLeft: { position: 'absolute', left: 8 },
  switchIconRight: { position: 'absolute', right: 8 },

  avatarContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },

  searchContainer: { paddingHorizontal: 24, marginBottom: 16 },
  searchPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 50, borderRadius: 16, borderWidth: 1 },
  input: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '500' },
  filterBtn: { padding: 8, borderRadius: 8 },

  filtersBox: { marginHorizontal: 24, padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  filterLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 },
  genderChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  genderText: { fontSize: 10, fontWeight: 'bold' },

  catChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, borderWidth: 1, marginRight: 10 },
  catText: { fontSize: 12, fontWeight: '600' },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  listTitle: { fontSize: 18, fontWeight: '700' },

  card: { borderRadius: 32, marginBottom: 24, borderWidth: 1, overflow: 'hidden' },
  cardImageContainer: { height: 160, width: '100%', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  heartBtn: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' },

  cardContent: { padding: 16, paddingTop: 20 },
  rowBetweenStart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  shopName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  rowMuted: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 12 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 12, fontWeight: 'bold' },

  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '600' },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 16 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: { padding: 6, borderRadius: 20 },
  tinyLabel: { fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  slotVal: { fontSize: 12, fontWeight: 'bold' },
  bookBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  bookBtnText: { fontSize: 12, fontWeight: 'bold' },
});
