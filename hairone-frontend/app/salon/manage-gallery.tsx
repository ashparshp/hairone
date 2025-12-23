import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { ChevronLeft, Trash2, Plus, Image as ImageIcon } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const IMG_SIZE = (width - 60) / 3;

export default function ManageGalleryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [shop, setShop] = useState<any>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    // @ts-ignore
    if (!user?.myShopId) {
       setLoading(false);
       return;
    }
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      setShop(res.data.shop);
      setGallery(res.data.shop.gallery || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (!result.canceled) {
      handleUpload(result.assets);
    }
  };

  const handleUpload = async (assets: ImagePicker.ImagePickerAsset[]) => {
      setUploading(true);
      try {
          const formData = new FormData();
          assets.forEach((asset, index) => {
             const filename = asset.uri.split('/').pop() || `gallery-${index}.jpg`;
             let match = /\.(\w+)$/.exec(filename);
             let type = match ? `image/${match[1]}` : `image/jpeg`;

             // @ts-ignore
             formData.append('gallery', {
               uri: asset.uri,
               name: filename,
               type: type
             });
          });

          const res = await api.post(`/shops/${shop._id}/gallery`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
          });

          setGallery(res.data.gallery || []);
          showToast("Images uploaded successfully!", "success");
      } catch (e: any) {
          console.log("Upload Error:", e);
          showToast("Failed to upload images.", "error");
      } finally {
          setUploading(false);
      }
  };

  const confirmDelete = (imgUrl: string) => {
      Alert.alert("Delete Image", "Are you sure you want to remove this image?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => handleDelete(imgUrl) }
      ]);
  };

  const handleDelete = async (imgUrl: string) => {
      try {
          const res = await api.delete(`/shops/${shop._id}/gallery`, {
              data: { imageUrl: imgUrl }
          });
          setGallery(res.data.gallery || []);
          showToast("Image removed.", "success");
      } catch (e) {
          console.log("Delete Error:", e);
          showToast("Failed to delete image.", "error");
      }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Manage Gallery</Text>
      </View>

      <View style={[styles.infoBox, {backgroundColor: 'rgba(245, 158, 11, 0.1)'}]}>
          <Text style={{color: colors.tint, fontSize: 12}}>
              Upload high-quality images of your shop, work, and happy customers to attract more bookings.
          </Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
          <View style={styles.grid}>
              {/* Add Button */}
              <TouchableOpacity
                 style={[styles.addBtn, {backgroundColor: colors.card, borderColor: colors.border, borderStyle: 'dashed'}]}
                 onPress={pickImages}
                 disabled={uploading}
              >
                  {uploading ? <ActivityIndicator color={colors.tint} /> : (
                      <>
                        <Plus size={32} color={colors.tint} />
                        <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 8}}>Add Photos</Text>
                      </>
                  )}
              </TouchableOpacity>

              {/* Images */}
              {gallery.map((img, index) => (
                  <View key={index} style={[styles.imgContainer, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Image source={{ uri: img }} style={styles.image} />
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(img)}>
                          <Trash2 size={14} color="white" />
                      </TouchableOpacity>
                  </View>
              ))}
          </View>

          {gallery.length === 0 && (
              <View style={{alignItems:'center', marginTop: 40, opacity: 0.5}}>
                  <ImageIcon size={48} color={colors.textMuted} />
                  <Text style={{color: colors.textMuted, marginTop: 12}}>No images yet.</Text>
              </View>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  infoBox: { padding: 12, borderRadius: 12, marginBottom: 20 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  addBtn: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  imgContainer: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },

  deleteBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(239, 68, 68, 0.8)', padding: 6, borderRadius: 20 }
});
