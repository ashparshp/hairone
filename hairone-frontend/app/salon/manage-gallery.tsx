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
import api from '../../services/api';
import { ChevronLeft, Trash2, Plus, Image as ImageIcon } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMG_SIZE = (width - 40 - (COLUMN_COUNT - 1) * 10) / COLUMN_COUNT;

export default function ManageGalleryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();

  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    // @ts-ignore
    if (!user?.myShopId) {
        setLoading(false);
        return;
    }
    try {
        // @ts-ignore
        const res = await api.get(`/shops/${user.myShopId}`);
        setGallery(res.data.shop.gallery || []);
    } catch (e) {
        console.log(e);
        Alert.alert("Error", "Failed to load gallery");
    } finally {
        setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Allow full aspect ratio
      quality: 0.8,
    });

    if (!result.canceled) {
        uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
      setUploading(true);
      try {
          const formData = new FormData();
          const filename = asset.uri.split('/').pop() || 'gallery-image.jpg';
          let match = /\.(\w+)$/.exec(filename);
          let type = match ? `image/${match[1]}` : `image/jpeg`;

          // @ts-ignore
          formData.append('image', {
              uri: asset.uri,
              name: filename,
              type: type
          });

          // @ts-ignore
          const res = await api.post(`/shops/${user.myShopId}/gallery`, formData, {
              transformRequest: (data, headers) => {
                  return data; // Prevent axios from serializing FormData
              }
          });

          setGallery(res.data.gallery || []);
      } catch (e: any) {
          console.log("Upload Error:", e);
          Alert.alert("Error", "Failed to upload image");
      } finally {
          setUploading(false);
      }
  }

  const handleDelete = async (imageUrl: string) => {
      Alert.alert(
          "Delete Image",
          "Are you sure you want to remove this image?",
          [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => {
                  try {
                      setLoading(true);
                      // @ts-ignore
                      const res = await api.delete(`/shops/${user.myShopId}/gallery`, {
                          data: { imageUrl }
                      });
                      setGallery(res.data.gallery || []);
                  } catch (e) {
                      Alert.alert("Error", "Failed to delete image");
                  } finally {
                      setLoading(false);
                  }
              }}
          ]
      );
  };

  if (loading && !uploading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Manage Gallery</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>

         {/* Upload Button */}
         <TouchableOpacity style={[styles.uploadBtn, {backgroundColor: colors.card, borderColor: colors.border}]} onPress={pickImage} disabled={uploading}>
             {uploading ? (
                 <ActivityIndicator color={colors.tint} />
             ) : (
                 <>
                    <View style={[styles.iconCircle, {backgroundColor: 'rgba(251, 191, 36, 0.1)'}]}>
                        <Plus size={32} color={colors.tint} />
                    </View>
                    <Text style={[styles.uploadText, {color: colors.text}]}>Add New Photo</Text>
                    <Text style={[styles.uploadSub, {color: colors.textMuted}]}>Tap to select from library</Text>
                 </>
             )}
         </TouchableOpacity>

         <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Current Photos ({gallery.length})</Text>

         {gallery.length === 0 ? (
             <View style={[styles.emptyState, {borderColor: colors.border}]}>
                 <ImageIcon size={48} color={colors.textMuted} />
                 <Text style={{color: colors.textMuted, marginTop: 12}}>No photos in your portfolio yet.</Text>
             </View>
         ) : (
             <View style={styles.grid}>
                 {gallery.map((img, index) => (
                     <FadeInView key={index} delay={index * 50}>
                        <View style={styles.imgContainer}>
                            <Image source={{uri: img}} style={styles.img} />
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(img)}>
                                <Trash2 size={14} color="white" />
                            </TouchableOpacity>
                        </View>
                     </FadeInView>
                 ))}
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

  uploadBtn: {
      width: '100%',
      height: 160,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 30
  },
  iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12
  },
  uploadText: { fontSize: 16, fontWeight: 'bold' },
  uploadSub: { fontSize: 12 },

  sectionTitle: { marginBottom: 16, fontSize: 14, fontWeight:'bold', textTransform:'uppercase', letterSpacing:1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imgContainer: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  deleteBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: 'rgba(0,0,0,0.6)',
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center'
  },
  emptyState: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 16
  }
});
