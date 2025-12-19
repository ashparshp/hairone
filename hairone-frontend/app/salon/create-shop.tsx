import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Camera, ChevronLeft } from 'lucide-react-native';

export default function CreateShopScreen() {
  const router = useRouter();
  const { user, login, token } = useAuth();
  
  const [name, setName] = useState(user?.businessName || ''); 
  const [address, setAddress] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (!name || !address) {
      return Alert.alert("Missing Fields", "Please add a Name and Address.");
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('address', address);

      if (imageUri) {
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('image', {
          uri: imageUri,
          name: filename,
          type: type,
        } as any);
      }

      await api.post('/shops', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const createdShop = res.data;

      // Update local user state
      if (user && token) {
        const updatedUser = { ...user, myShopId: createdShop._id, role: 'owner' };
        login(token, updatedUser);
      }

      Alert.alert("Success", "Shop Created Successfully!");
      router.replace('/(tabs)/dashboard' as any);
      
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Could not create shop.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>Create Your Shop</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
          <View style={styles.section}>
            <Text style={styles.label}>Shop Name</Text>
            <TextInput 
                style={styles.input} 
                value={name} 
                onChangeText={setName} 
                placeholder="e.g. Royal Cuts" 
                placeholderTextColor="#64748b" 
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Address</Text>
            <TextInput 
                style={styles.input} 
                value={address} 
                onChangeText={setAddress} 
                placeholder="Street, City, Zip" 
                placeholderTextColor="#64748b" 
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Shop Image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                ) : (
                    <View style={{alignItems: 'center'}}>
                        <Camera size={32} color={Colors.primary} />
                        <Text style={{color: Colors.textMuted, marginTop: 8}}>Tap to upload photo</Text>
                    </View>
                )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={loading}>
             {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Launch Shop 🚀</Text>}
          </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  section: { marginBottom: 24 },
  label: { color: 'white', fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: Colors.card, color: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, fontSize: 16 },
  imagePicker: { height: 200, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  createBtn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 18 }
});