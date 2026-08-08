import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Star, MapPin, HeartOff } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { FadeInView } from "../../components/AnimatedViews";
import { RemoteImage } from "../../components/RemoteImage";
import { getFavoriteShops } from "../../services/favorites";
import { Shop } from "../../types";

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [favorites, setFavorites] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const shops = await getFavoriteShops();
      setFavorites(shops);
    } catch (e) {
      console.log("Error fetching favorites:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [fetchFavorites]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites(true);
  };

  const renderItem = ({ item, index }: { item: Shop; index: number }) => (
    <FadeInView delay={index * 100}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => router.push(`/salon/${item._id}`)}
      >
        <RemoteImage uri={item.image} style={styles.image} resizeMode="cover" />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.rating, { backgroundColor: colors.tint }]}>
              <Star size={12} color="black" fill="black" />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <MapPin size={14} color={colors.textMuted} />
            <Text
              style={[styles.address, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {item.address}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Saved</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Shops you favorited
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <HeartOff size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>
                No favorites yet
              </Text>
              <TouchableOpacity
                style={[styles.browseBtn, { backgroundColor: colors.tint }]}
                onPress={() => router.push("/(tabs)/home")}
              >
                <Text style={styles.browseBtnText}>Browse salons</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { paddingHorizontal: 20, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginTop: 4 },
  list: { padding: 20, paddingBottom: 120 },
  card: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  image: { width: 100, height: 100 },
  info: { flex: 1, padding: 12, justifyContent: "center" },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: { fontWeight: "bold", fontSize: 16, marginBottom: 4, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  address: { fontSize: 12, flex: 1 },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: { fontSize: 10, fontWeight: "bold", color: "black" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyTitle: { marginTop: 16, fontSize: 15 },
  browseBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: { fontWeight: "700", color: "#0f172a" },
});
