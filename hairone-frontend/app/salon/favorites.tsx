import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Star, MapPin, HeartOff } from 'lucide-react-native';
import api from '../../services/api';
import Colors from '../../constants/Colors';

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/shops/favorites');
      setFavorites(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push(`/salon/${item._id}`)}
    >
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.info}>
         <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.rating}>
                <Star size={12} color="black" fill="black" />
                <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
         </View>
         <View style={styles.row}>
            <MapPin size={14} color={Colors.textMuted} />
            <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
         </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>My Favorites</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{padding: 20}}
          ListEmptyComponent={
            <View style={styles.empty}>
               <HeartOff size={48} color={Colors.textMuted} />
               <Text style={{color: Colors.textMuted, marginTop: 16}}>No favorites yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  card: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  image: { width: 100, height: 100 },
  info: { flex: 1, padding: 12, justifyContent: 'center' },
  name: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  address: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  ratingText: { fontSize: 10, fontWeight: 'bold', color: 'black' },
  empty: { alignItems: 'center', marginTop: 100, opacity: 0.5 }
});