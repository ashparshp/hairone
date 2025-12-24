import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Trash2, Plus, Image as ImageIcon } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function ManageGalleryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { colors, theme } = useTheme();

  // Determine Target Shop ID: either passed via params (Admin) or from user profile (Owner)
  const getTargetShopId = () => {
    if (params.shopId) {
      return Array.isArray(params.shopId) ? params.shopId[0] : params.shopId;
    }
    if (user?.myShopId) {
      // @ts-ignore
      return typeof user.myShopId === 'object' ? user.myShopId._id : user.myShopId;
    }
    return null;
  };

  const targetShopId = getTargetShopId();

  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchGallery();
  }, [targetShopId]);

  const fetchGallery = async () => {
    if (!targetShopId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/shops/${targetShopId}`);
      setGallery(res.data.shop.gallery || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  };

  const handleAddImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0].uri) {
        uploadImage(result.assets[0].uri);
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const filename = uri.split('/').pop() || 'gallery-image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      // @ts-ignore
      formData.append('image', {
        uri: uri,
        name: filename,
        type: type
      });

      const res = await api.post(`/shops/${targetShopId}/gallery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setGallery(res.data.gallery || []);
      Alert.alert("Success", "Image uploaded successfully");
    } catch (e: any) {
      console.log("Upload Error:", e);
      Alert.alert("Error", "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/shops/${targetShopId}/gallery`, {
                data: { imageUrl }
              });
              setGallery(res.data.gallery || []);
            } catch (e) {
              console.log("Delete Error:", e);
              Alert.alert("Error", "Failed to delete image");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => setSelectedImage(item)}
    >
      <Image source={{ uri: item }} style={styles.thumbnail} />
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDeleteImage(item)}
      >
        <Trash2 size={16} color="white" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Manage Gallery</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : (
        <FadeInView style={{ flex: 1 }}>
          <FlatList
            data={gallery}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            numColumns={2}
            contentContainerStyle={styles.grid}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <ImageIcon size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No images in gallery yet.</Text>
              </View>
            }
          />
        </FadeInView>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.tint }]}
        onPress={handleAddImage}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Plus size={24} color="black" />
        )}
      </TouchableOpacity>

      {/* Image Viewer Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.closeArea} onPress={() => setSelectedImage(null)} />
          <View style={styles.modalContent}>
            <Image source={{ uri: selectedImage || '' }} style={styles.fullImage} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedImage(null)}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  grid: { padding: 10 },
  imageCard: {
    flex: 1,
    margin: 6,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative'
  },
  thumbnail: { width: '100%', height: '100%' },
  deleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.8)', // red-500 with opacity
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeArea: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '90%', height: '70%' },
  fullImage: { width: '100%', height: '100%' },
  closeBtn: { position: 'absolute', top: 50, right: 20, padding: 10 },
  closeBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});
