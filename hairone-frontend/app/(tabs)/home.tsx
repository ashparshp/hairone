import { useFocusEffect, useRouter } from "expo-router";
import { AlertCircle, MapPin, Search, Star, Clock, Filter, Moon, Sun } from "lucide-react-native";
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
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { FadeInView } from "../../components/AnimatedViews";
import api from "../../services/api";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minTime, setMinTime] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');

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
      setShops(res.data);
    } catch (e) {
      console.log("Error fetching shops:", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredShops = shops.filter((s: any) =>
    s.name.toLowerCase().includes(searchText.toLowerCase()) ||
    s.address?.toLowerCase().includes(searchText.toLowerCase())
  );

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

  const renderShop = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 100}>
        <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
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
            <Text style={[styles.shopName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.ratingBadge, { backgroundColor: colors.tint }]}>
                <Star size={12} color="black" fill="black" />
                <Text style={styles.ratingText}>{item.rating || 'New'}</Text>
            </View>
            </View>
            <View style={styles.rowMuted}>
            <MapPin size={14} color={colors.textMuted} />
            <Text style={[styles.addressText, { color: colors.textMuted }]} numberOfLines={1}>{item.address}</Text>
            </View>

            {/* Next Available Slot Indicator */}
            <View style={[styles.slotBadge, !item.nextAvailableSlot && styles.slotBadgeMuted]}>
            <Clock size={12} color={item.nextAvailableSlot ? colors.tint : colors.textMuted} />
            <Text style={[styles.slotText, { color: item.nextAvailableSlot ? colors.tint : colors.textMuted }]}>
                {item.nextAvailableSlot
                    ? `Earliest: ${item.nextAvailableSlot}`
                    : 'No slots today'}
            </Text>
            </View>
        </View>
        </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.text }]}>
            Hello, <Text style={{color: colors.tint}}>{user?.name?.split(' ')[0] || "Guest"}</Text>
          </Text>
          <Text style={[styles.subGreeting, { color: colors.textMuted }]}>Look sharp, book smart.</Text>
        </View>
        <View style={{flexDirection: 'row', gap: 12}}>
            <TouchableOpacity onPress={toggleTheme} style={[styles.avatar, {backgroundColor: colors.card, borderColor: colors.border}]}>
                {theme === 'dark' ? <Sun size={20} color="white"/> : <Moon size={20} color="black"/>}
            </TouchableOpacity>
            <View style={[styles.avatar, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <Text style={{ color: colors.text, fontWeight: "bold", fontSize: 18 }}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </Text>
            </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={20} color={colors.textMuted} />
        <TextInput
          placeholder="Search for salons..."
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.filterBtn, {backgroundColor: colors.tint}]}>
          <Filter size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Filters Container */}
      {showFilters && (
      <View style={{ marginBottom: 20 }}>

        {/* Type Filter */}
        <View style={{marginBottom: 16}}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Filter by Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {typeOptions.map((opt, i) => (
                    <TouchableOpacity
                    key={i}
                    style={[styles.filterChip, { backgroundColor: colors.card, borderColor: colors.border }, filterType === opt.value && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                    onPress={() => setFilterType(opt.value)}
                    >
                    <Text style={[styles.filterText, { color: colors.textMuted }, filterType === opt.value && { color: 'black', fontWeight: 'bold' }]}>
                        {opt.label}
                    </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {/* Time Filter */}
        <View>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Filter by Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {timeOptions.map((opt, i) => (
                <TouchableOpacity
                key={i}
                style={[styles.filterChip, { backgroundColor: colors.card, borderColor: colors.border }, minTime === opt.value && { backgroundColor: colors.tint, borderColor: colors.tint }]}
                onPress={() => setMinTime(opt.value)}
                >
                <Text style={[styles.filterText, { color: colors.textMuted }, minTime === opt.value && { color: 'black', fontWeight: 'bold' }]}>
                    {opt.label}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>
        </View>
      </View>
      )}

      {/* Shop List */}
      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 50 }}
          color={colors.tint}
          size="large"
        />
      ) : (
        <FlatList
          data={filteredShops}
          renderItem={renderShop}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <AlertCircle size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No shops found.</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>Try adjusting your filters.</Text>
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
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: { fontSize: 24, fontWeight: "bold" },
  subGreeting: { fontSize: 14, marginTop: 2 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  searchContainer: {
    flexDirection: "row",
    padding: 6,
    paddingLeft: 12,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '500', height: 44 },
  filterBtn: {
     padding: 10,
     borderRadius: 10
  },

  card: {
    borderRadius: 20,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4}
  },
  cardImage: { width: "100%", height: 180, backgroundColor: "#1e293b" },
  badgeContainer: { position: 'absolute', top: 12, right: 12 },
  typeBadge: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backdropFilter: 'blur(10px)' },
  typeBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardContent: { padding: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  shopName: { fontSize: 18, fontWeight: "bold", flex: 1, marginRight: 8 },
  ratingBadge: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: "bold", color: "black" },
  rowMuted: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { fontSize: 14, flex: 1 },

  slotBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  slotBadgeMuted: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  slotText: { fontSize: 12, fontWeight: 'bold' },

  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, marginRight: 10, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },

  emptyState: { alignItems: "center", marginTop: 50, opacity: 0.7 },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
  },
  emptySub: { marginTop: 4 },
});
