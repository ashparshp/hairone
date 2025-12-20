import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, MapPin, Search, Star, Clock } from "lucide-react-native";
import React, { useCallback, useState } from "react";
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
} from "react-native";
import Colors from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minTime, setMinTime] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [minTime, filterType])
  );

  const fetchShops = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (minTime) params.append('minTime', minTime);
      if (filterType !== 'all') params.append('type', filterType);

      const res = await api.get(`/shops?${params.toString()}`);
      console.log("Fetched Shops:", res.data); // Debugging Log
      setShops(res.data);
    } catch (e) {
      console.log("Error fetching shops:", e);
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = [
    { label: "Now", value: null },
    { label: "After 12 PM", value: "12:00" },
    { label: "After 2 PM", value: "14:00" },
    { label: "After 4 PM", value: "16:00" },
    { label: "After 6 PM", value: "18:00" },
  ];

  const typeOptions = [
    { label: "All", value: "all" },
    { label: "Unisex", value: "unisex" },
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
  ];

  const renderShop = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => router.push(`/salon/${item._id}`)}
    >
      <Image 
        source={{ uri: item.image || 'https://via.placeholder.com/400' }} 
        style={styles.cardImage} 
        resizeMode="cover"
      />
      <View style={styles.badgeContainer}>
         <View style={styles.typeBadge}>
             <Text style={styles.typeBadgeText}>{item.type || 'Unisex'}</Text>
         </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.row}>
          <Text style={styles.shopName}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Star size={12} color="black" fill="black" />
            <Text style={styles.ratingText}>{item.rating || 'New'}</Text>
          </View>
        </View>
        <View style={styles.rowMuted}>
          <MapPin size={14} color={Colors.textMuted} />
          <Text style={styles.addressText}>{item.address}</Text>
        </View>
        
        {/* Next Available Slot Indicator */}
        <View style={[styles.rowMuted, { marginTop: 8 }]}>
           <Clock size={14} color={Colors.primary} />
           <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: 'bold' }}>
              {item.nextAvailableSlot 
                ? `Earliest: ${item.nextAvailableSlot}` 
                : 'No slots available today'}
           </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.name || user?.phone || "Guest"}
          </Text>
          <Text style={styles.subGreeting}>Find the best cut near you</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={{ color: "white", fontWeight: "bold" }}>U</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textMuted} />
        <TextInput
          placeholder="Search salons, services..."
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      {/* Filters Container */}
      <View style={{ marginBottom: 20 }}>

        {/* Type Filter */}
        <View style={{marginBottom: 16}}>
            <Text style={styles.sectionTitle}>Filter by Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {typeOptions.map((opt, i) => (
                    <TouchableOpacity
                    key={i}
                    style={[styles.filterChip, filterType === opt.value && styles.filterChipActive]}
                    onPress={() => setFilterType(opt.value)}
                    >
                    <Text style={[styles.filterText, filterType === opt.value && { color: 'black', fontWeight: 'bold' }]}>
                        {opt.label}
                    </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Time Filter */}
        <View>
            <Text style={styles.sectionTitle}>Filter by Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {timeOptions.map((opt, i) => (
                <TouchableOpacity
                key={i}
                style={[styles.filterChip, minTime === opt.value && styles.filterChipActive]}
                onPress={() => setMinTime(opt.value)}
                >
                <Text style={[styles.filterText, minTime === opt.value && { color: 'black', fontWeight: 'bold' }]}>
                    {opt.label}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        </View>
      </View>

      {/* Shop List */}
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 50 }}
          color={Colors.primary}
          size="large"
        />
      ) : (
        <FlatList
          data={shops}
          renderItem={renderShop}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No shops found.</Text>
              <Text style={styles.emptySub}>Be the first to create one!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "white" },
  subGreeting: { color: Colors.textMuted, fontSize: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },

  searchContainer: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchInput: { flex: 1, color: "white", marginLeft: 12, fontSize: 16, fontWeight: '500' },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 200,
  },
  cardImage: { width: "100%", height: 180, backgroundColor: "#1e293b" },
  badgeContainer: { position: 'absolute', top: 10, right: 10 },
  typeBadge: { backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  cardContent: { padding: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  shopName: { color: "white", fontSize: 18, fontWeight: "bold", flex: 1 },
  ratingBadge: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: "bold", color: "black" },
  rowMuted: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { color: Colors.textMuted, fontSize: 14 },

  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, marginRight: 10, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: 12 },

  emptyState: { alignItems: "center", marginTop: 50, opacity: 0.7 },
  emptyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  emptySub: { color: Colors.textMuted, marginTop: 4 },
});
