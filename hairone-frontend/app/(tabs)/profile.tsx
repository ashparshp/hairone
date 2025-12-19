import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import Colors from '../../constants/Colors';
import { LogOut, User, Briefcase, Clock, AlertCircle } from 'lucide-react-native';
import api from '../../services/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  
  const [applying, setApplying] = useState(false);
  const [bizName, setBizName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state to prevent flickering during logout
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    // 1. Immediately hide the screen content
    setIsLoggingOut(true);

    // 2. Wait slightly for the UI to update, then logout
    setTimeout(() => {
        logout();
    }, 500); 
  };

  const handleApply = async () => {
    if (!bizName.trim()) {
      return Alert.alert("Required", "Please enter a Shop Name");
    }

    setIsSubmitting(true);
    try {
      await api.post('/admin/apply', { businessName: bizName });
      
      Alert.alert(
        "Application Submitted", 
        "Your request has been sent to the Admin. Please log in again to see the changes.",
        [{ 
           text: "OK, Log Out", 
           onPress: handleLogout // Use the smooth logout function
        }]
      );

    } catch (e) {
      Alert.alert("Error", "Application failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  // --- PREVENT FLICKER: Show simple loader if logging out ---
  if (isLoggingOut) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{color: Colors.textMuted, marginTop: 10}}>Logging out...</Text>
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.avatar}>
            <User size={40} color="#94a3b8" />
         </View>
         <Text style={styles.name}>{user?.phone || 'User'}</Text>
         <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? '#ef4444' : Colors.primary }]}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
         </View>
      </View>

      <View style={styles.section}>
          {user?.role === 'user' && user?.applicationStatus === 'none' && (
             <View style={styles.promoCard}>
                {!applying ? (
                  <>
                    <Briefcase size={32} color={Colors.primary} />
                    <View style={{flex: 1}}>
                        <Text style={styles.promoTitle}>Become a Partner</Text>
                        <Text style={styles.promoSub}>List your shop, manage barbers, and grow.</Text>
                    </View>
                    <TouchableOpacity style={styles.applyBtn} onPress={() => setApplying(true)}>
                        <Text style={styles.applyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{width: '100%'}}>
                     <Text style={styles.label}>Enter Shop Name</Text>
                     <TextInput 
                        style={styles.input} 
                        placeholder="e.g. Royal Cuts" 
                        placeholderTextColor="#64748b"
                        value={bizName}
                        onChangeText={setBizName}
                        autoFocus={true} 
                     />
                     <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                        <TouchableOpacity 
                          style={[styles.applyBtn, {backgroundColor: '#334155', flex: 1}]} 
                          onPress={() => { setApplying(false); setIsSubmitting(false); }}
                          disabled={isSubmitting}
                        >
                            <Text style={styles.applyBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={[styles.applyBtn, {flex: 1, opacity: isSubmitting ? 0.7 : 1}]} 
                          onPress={handleApply}
                          disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                              <ActivityIndicator color="#020617" size="small" /> 
                            ) : (
                              <Text style={styles.applyBtnText}>Submit</Text>
                            )}
                        </TouchableOpacity>
                     </View>
                  </View>
                )}
             </View>
          )}

          {user?.applicationStatus === 'pending' && (
             <View style={[styles.promoCard, {borderColor: '#eab308'}]}>
                <Clock size={24} color="#eab308" />
                <View style={{flex: 1}}>
                    <Text style={[styles.promoTitle, {color: '#eab308'}]}>Application Pending</Text>
                    <Text style={styles.promoSub}>Our admin is reviewing your request.</Text>
                </View>
             </View>
          )}

          {user?.applicationStatus === 'rejected' && (
             <View style={[styles.promoCard, {borderColor: '#ef4444'}]}>
                <AlertCircle size={24} color="#ef4444" />
                <View style={{flex: 1}}>
                    <Text style={[styles.promoTitle, {color: '#ef4444'}]}>Application Rejected</Text>
                    <Text style={styles.promoSub}>Please contact support.</Text>
                </View>
             </View>
          )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleLogout}>
         <LogOut size={20} color="#ef4444" />
         <Text style={styles.btnText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 80, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginBottom: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  name: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  roleText: { color: '#0f172a', fontWeight: 'bold', fontSize: 10, letterSpacing: 1 },
  section: { marginBottom: 30 },
  promoCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Colors.border },
  promoTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  promoSub: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  applyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 },
  label: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#0f172a', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', width: '100%' },
  btn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 12, justifyContent: 'center', gap: 12 },
  btnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});