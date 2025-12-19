import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, MapPin, Search, Star } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

  useFocusEffect(
    useCallback(() => {
      fetchShops();
    }, [])
  );

  const fetchShops = async () => {
    try {
      const res = await api.get("/shops");
      console.log("Fetched Shops:", res.data); // Debugging Log
      setShops(res.data);
    } catch (e) {
      console.log("Error fetching shops:", e);
      // Optional: Alert the user if connection fails
      // Alert.alert("Error", "Could not load shops. Check your internet.");
    } finally {
      setLoading(false);
    }
  };

// app/(tabs)/home.tsx

  const renderShop = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      // ✅ CHANGE THIS LINE: from '/shop/[id]' to '/salon/[id]'
      onPress={() => router.push(`/salon/${item._id}`)}
    >
      <Image 
        source={{ uri: item.image || 'https://via.placeholder.com/400' }} 
        style={styles.cardImage} 
        resizeMode="cover"
      />
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
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: "white", marginLeft: 10, fontSize: 16 },

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

  emptyState: { alignItems: "center", marginTop: 50, opacity: 0.7 },
  emptyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  emptySub: { color: Colors.textMuted, marginTop: 4 },
});
