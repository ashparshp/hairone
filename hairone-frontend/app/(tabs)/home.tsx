import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertCircle,
  Filter,
  MapPin,
  Moon,
  Search,
  Sun,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import Logo from "../../components/Logo";
import { ScalePress } from "../../components/ScalePress";
import { ShopCard } from "../../components/ShopCard";
import { ShopCardSkeleton } from "../../components/ShopCardSkeleton";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api";

const { width } = Dimensions.get("window");

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "hair", label: "Haircut" },
  { id: "beard", label: "Beard" },
  { id: "facial", label: "Facial" },
  { id: "spa", label: "Spa" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, login, token } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [rawShops, setRawShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [genderFilter, setGenderFilter] = useState("All");
  const [distanceFilter, setDistanceFilter] = useState(10);

  // Location State
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [locationName, setLocationName] = useState("Locating...");
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Animation for Theme Toggle
  const toggleX = useSharedValue(isDark ? 28 : 0);

  useEffect(() => {
    toggleX.value = withTiming(isDark ? 28 : 0, { duration: 300 });
  }, [isDark]);

  const animatedToggleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: toggleX.value }],
    };
  });

  // Location Logic
  const refreshLocation = async () => {
    setLocationName("Locating...");
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationName("Permission Denied");
      return;
    }
    setPermissionGranted(true);

    try {
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      let address = await Location.reverseGeocodeAsync(loc.coords);
      if (address[0]) {
        const city = address[0].city || address[0].region || "Unknown City";
        const country = address[0].isoCountryCode || "";
        setLocationName(`${city}, ${country}`);
      } else {
        setLocationName("Current Location");
      }
    } catch (e) {
      setLocationName("Location Unavailable");
    }
  };

  useEffect(() => {
    refreshLocation();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [location, distanceFilter, genderFilter])
  );

  // Live Filtering
  const shops = useMemo(() => {
    let filtered = rawShops;

    if (searchText) {
      filtered = filtered.filter(
        (s: any) =>
          s.name.toLowerCase().includes(searchText.toLowerCase()) ||
          s.address.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (activeCategory !== "all") {
      filtered = filtered.filter((s: any) =>
        s.services?.some((svc: any) =>
          svc.name.toLowerCase().includes(activeCategory.toLowerCase())
        )
      );
    }

    return filtered;
  }, [rawShops, searchText, activeCategory]);

  const toggleFavorite = async (shopId: string) => {
    if (!user) return;

    try {
      const res = await api.post("/auth/favorites", { shopId });
      const updatedUser = { ...user, favorites: res.data };
      if (token) login(token, updatedUser);
    } catch (e) {
      console.log("Error toggling favorite:", e);
    }
  };

  const fetchShops = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (activeCategory !== "all") params.append("category", activeCategory);

      if (genderFilter !== "All") {
        const typeMap: any = { Men: "male", Women: "female", Unisex: "unisex" };
        params.append("type", typeMap[genderFilter] || "all");
      }

      if (location) {
        params.append("lat", location.coords.latitude.toString());
        params.append("lng", location.coords.longitude.toString());
        params.append("radius", distanceFilter.toString());
      }

      const res = await api.get(`/shops?${params.toString()}`);
      setRawShops(res.data);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ marginBottom: 4 }}>
            <Logo width={100} height={40} />
          </View>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={refreshLocation}
          >
            <MapPin size={14} color={colors.primary} fill={colors.primary} />
            <Text style={[styles.locationText, { color: colors.textMuted }]}>
              {locationName}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeToggle,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.themeIconContainer,
                animatedToggleStyle,
                {
                  backgroundColor: isDark ? colors.border : "white",
                },
              ]}
            >
              {isDark ? (
                <Moon size={10} color={colors.tint} />
              ) : (
                <Sun size={10} color={colors.primary} />
              )}
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.avatarContainer,
              { borderColor: isDark ? colors.border : "white" },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Image
              source={{
                uri: user?.avatar || "https://via.placeholder.com/100",
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
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
            isFavorite={user?.favorites?.includes(item._id)}
            onToggleFavorite={toggleFavorite}
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
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Search size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Find a salon or service..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { color: colors.text }]}
                  value={searchText}
                  onChangeText={setSearchText}
                />
                <ScalePress
                  onPress={() => setShowFilters(!showFilters)}
                  style={[
                    styles.filterBtn,
                    showFilters && { backgroundColor: colors.primary },
                  ]}
                >
                  <Filter
                    size={18}
                    color={showFilters ? "white" : colors.textMuted}
                  />
                </ScalePress>
              </View>
            </View>

            {/* Collapsible Filters */}
            {showFilters && (
              // UPDATED: Background colors.background (True Black), reduced padding to 16
              <View
                style={[
                  styles.filterContainer,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Gender Filter */}
                <View style={styles.filterGroup}>
                  <Text
                    style={[styles.filterLabel, { color: colors.textMuted }]}
                  >
                    Gender
                  </Text>
                  <View style={styles.chipRow}>
                    {["All", "Men", "Women", "Unisex"].map((g) => (
                      <ScalePress
                        key={g}
                        onPress={() => setGenderFilter(g)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor:
                              genderFilter === g
                                ? colors.primary
                                : isDark
                                ? colors.card
                                : colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color:
                                genderFilter === g
                                  ? "white"
                                  : isDark
                                  ? colors.text
                                  : colors.textMuted,
                            },
                          ]}
                        >
                          {g}
                        </Text>
                      </ScalePress>
                    ))}
                  </View>
                </View>

                {/* Distance Filter */}
                <View style={styles.filterGroup}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={[styles.filterLabel, { color: colors.textMuted }]}
                    >
                      Distance
                    </Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      {distanceFilter === 10 ? "All" : `< ${distanceFilter} km`}
                    </Text>
                  </View>
                  <Slider
                    style={{ width: "100%", height: 40 }}
                    minimumValue={1}
                    maximumValue={10}
                    step={1}
                    value={distanceFilter}
                    onValueChange={setDistanceFilter}
                    minimumTrackTintColor={colors.primary}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.primary}
                  />
                </View>
              </View>
            )}

            {/* Categories */}
            <View style={styles.categoriesSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24 }}
              >
                {CATEGORIES.map((cat) => (
                  <ScalePress
                    key={cat.id}
                    onPress={() => setActiveCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor:
                          activeCategory === cat.id
                            ? isDark
                              ? colors.tint
                              : "#0f172a"
                            : colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catText,
                        {
                          color:
                            activeCategory === cat.id
                              ? isDark
                                ? "#0f172a"
                                : "white"
                              : colors.textMuted,
                        },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </ScalePress>
                ))}
              </ScrollView>
            </View>

            <View style={styles.listHeader}>
              <Text style={[styles.heading, { color: colors.text }]}>
                Nearby Salons
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <ShopCardSkeleton key={i} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No salons found nearby.
              </Text>
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
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeToggle: {
    width: 56,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  themeIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
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
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },

  // Search
  searchSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  filterBtn: {
    padding: 6,
    borderRadius: 8,
  },

  // Filters
  filterContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "bold",
  },

  // Categories
  categoriesSection: {
    marginBottom: 24,
  },
  catChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  catText: {
    fontSize: 12,
    fontWeight: "bold",
  },

  listHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: 100, // Space for bottom nav
  },
  emptyState: {
    alignItems: "center",
    marginTop: 40,
    opacity: 0.7,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
});
