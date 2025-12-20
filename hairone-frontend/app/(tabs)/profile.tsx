import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, 
  ActivityIndicator, ScrollView, Modal, Platform 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import Colors from '../../constants/Colors';
import { 
  LogOut, User, Briefcase, ChevronRight, Edit2, Heart, 
  Settings, HelpCircle, FileText, X, Clock, ShieldAlert, Mail
} from 'lucide-react-native';
import api from '../../services/api';

export default function ProfileScreen() {
  const { user, logout, login, token } = useAuth();
  const router = useRouter();
  
  const [applying, setApplying] = useState(false);
  const [bizName, setBizName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [editGender, setEditGender] = useState(user?.gender || 'male');
  const [savingProfile, setSavingProfile] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => {
          setIsLoggingOut(true);
          setTimeout(() => logout(), 500); 
      }}
    ]);
  };

  const handleApply = async () => {
    if (!bizName.trim() || !ownerName.trim()) return Alert.alert("Required", "Please enter Shop Name and Your Name");
    setIsSubmitting(true);
    try {
      await api.post('/admin/apply', { businessName: bizName, ownerName });
      Alert.alert("Success", "Application Submitted! Changes apply after re-login.", [{ text: "OK", onPress: () => { setApplying(false); setIsSubmitting(false); } }]);
    } catch (e) {
      Alert.alert("Error", "Application failed.");
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
      setSavingProfile(true);
      try {
          const res = await api.put('/auth/profile', { name: editName, email: editEmail, gender: editGender });
          if (token) login(token, { ...user, ...res.data });
          setEditModalVisible(false);
          Alert.alert("Success", "Profile Updated");
      } catch (e) {
          Alert.alert("Error", "Failed to update profile");
      } finally {
          setSavingProfile(false);
      }
  };

  const MenuItem = ({ icon: Icon, label, subLabel, onPress, destructive = false }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconBox, destructive && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
        <Icon size={20} color={destructive ? '#ef4444' : Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, destructive && { color: '#ef4444' }]}>{label}</Text>
        {subLabel && <Text style={styles.menuSubLabel}>{subLabel}</Text>}
      </View>
      <ChevronRight size={16} color="#475569" />
    </TouchableOpacity>
  );

  const StatBox = ({ label, value }: any) => (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (isLoggingOut) return <View style={styles.centerLoading}><ActivityIndicator size="large" color={Colors.primary} /><Text style={{color:Colors.textMuted, marginTop:16}}>Logging out...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.header}>
         <View style={styles.avatarContainer}>
            <View style={styles.avatar}><User size={40} color="#94a3b8" /></View>
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setEditModalVisible(true)}><Edit2 size={12} color="white" /></TouchableOpacity>
         </View>
         <Text style={styles.name}>{user?.name || 'Guest User'}</Text>
         {user?.email && <Text style={styles.email}>{user?.email}</Text>}
         <View style={[styles.roleBadge, user?.role === 'admin' ? { backgroundColor: '#ef4444' } : user?.role === 'owner' ? { backgroundColor: Colors.primary } : { backgroundColor: '#334155' }]}>
            <Text style={[styles.roleText, user?.role === 'user' && {color: 'white'}]}>{user?.role?.toUpperCase()}</Text>
         </View>
      </View>

      <View style={styles.statsRow}>
          <StatBox value={user?.favorites?.length || 0} label="Favorites" />
          <View style={styles.statDivider} />
          <StatBox value={user?.role === 'user' ? '0' : 'N/A'} label="Bookings" />
          <View style={styles.statDivider} />
          <StatBox value={user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '-'} label="Gender" />
      </View>

      <View style={styles.section}>
          {user?.role === 'user' && user?.applicationStatus === 'none' && (
             <View style={styles.promoCard}>
                {!applying ? (
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 16}}>
                    <View style={styles.promoIcon}><Briefcase size={24} color="#0f172a" /></View>
                    <View style={{flex: 1}}>
                        <Text style={styles.promoTitle}>Partner with HairOne</Text>
                        <Text style={styles.promoSub}>List your shop & manage bookings.</Text>
                    </View>
                    <TouchableOpacity style={styles.applyBtn} onPress={() => setApplying(true)}><Text style={styles.applyBtnText}>Apply</Text></TouchableOpacity>
                  </View>
                ) : (
                  <View>
                     <Text style={styles.sectionTitleBlack}>Partner Application</Text>
                     <Text style={styles.inputLabelDark}>Owner Name</Text>
                     <TextInput style={styles.inputLight} value={ownerName} onChangeText={setOwnerName} placeholder="Your Full Name" />
                     <Text style={styles.inputLabelDark}>Shop Name</Text>
                     <TextInput style={styles.inputLight} value={bizName} onChangeText={setBizName} placeholder="Business Name" />
                     <View style={{flexDirection: 'row', gap: 10, marginTop: 12}}>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#cbd5e1'}]} onPress={() => setApplying(false)}><Text style={{fontWeight: 'bold'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#0f172a', flex: 1}]} onPress={handleApply}>
                            {isSubmitting ? <ActivityIndicator color="white"/> : <Text style={{color: 'white', fontWeight: 'bold'}}>Submit Application</Text>}
                        </TouchableOpacity>
                     </View>
                  </View>
                )}
             </View>
          )}
          {user?.applicationStatus === 'pending' && (
             <View style={[styles.statusCard, { borderColor: '#eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)' }]}>
                <Clock size={24} color="#eab308" />
                <View style={{flex: 1}}>
                    <Text style={[styles.statusTitle, {color: '#eab308'}]}>Application Pending</Text>
                    <Text style={styles.statusSub}>We are reviewing your request.</Text>
                </View>
             </View>
          )}
          {user?.applicationStatus === 'rejected' && (
             <View style={[styles.statusCard, { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <ShieldAlert size={24} color="#ef4444" />
                <View style={{flex: 1}}>
                    <Text style={[styles.statusTitle, {color: '#ef4444'}]}>Application Rejected</Text>
                    <Text style={styles.statusSub}>Please contact support for details.</Text>
                </View>
             </View>
          )}
      </View>

      <View style={styles.menuContainer}>
          <Text style={styles.sectionHeader}>Account Settings</Text>
          <MenuItem 
            icon={Edit2} label="Edit Profile" subLabel="Update details" 
            onPress={() => {
              setEditName(user?.name || '');
              setEditEmail(user?.email || '');
              setEditGender(user?.gender || 'male');
              setEditModalVisible(true);
            }} 
          />
          <MenuItem 
            icon={Heart} label="My Favorites" 
            subLabel={`${user?.favorites?.length || 0} saved shops`}
            onPress={() => router.push('/salon/favorites' as any)} 
          />
          
          <Text style={[styles.sectionHeader, {marginTop: 24}]}>Support</Text>
          <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => {}} />
          <MenuItem icon={LogOut} label="Log Out" destructive onPress={handleLogout} />
      </View>
      <Text style={styles.versionText}>Version 1.0.2</Text>

      <Modal visible={editModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Update Profile</Text>
                      <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}><X size={20} color="white" /></TouchableOpacity>
                  </View>
                  <View style={styles.modalBody}>
                      <Text style={styles.label}>Full Name</Text>
                      <View style={styles.inputContainer}>
                          <User size={20} color={Colors.textMuted} style={{marginLeft: 12}} />
                          <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} placeholder="Your Name" placeholderTextColor="#64748b" />
                      </View>
                      <Text style={styles.label}>Email Address</Text>
                      <View style={styles.inputContainer}>
                          <Mail size={20} color={Colors.textMuted} style={{marginLeft: 12}} />
                          <TextInput style={styles.modalInput} value={editEmail} onChangeText={setEditEmail} placeholder="john@example.com" placeholderTextColor="#64748b" keyboardType="email-address" />
                      </View>
                      <Text style={styles.label}>Gender</Text>
                      <View style={styles.genderRow}>
                          {['male', 'female', 'other'].map(g => (
                              <TouchableOpacity key={g} style={[styles.genderChip, editGender === g && styles.genderChipActive]} onPress={() => setEditGender(g as any)}>
                                  <Text style={[styles.genderText, editGender === g && {color: 'black', fontWeight: 'bold'}]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                              </TouchableOpacity>
                          ))}
                      </View>
                      <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile} disabled={savingProfile}>
                          {savingProfile ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerLoading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.card, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: Colors.background },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary, padding: 6, borderRadius: 20, borderWidth: 2, borderColor: Colors.background },
  name: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 2 },
  email: { fontSize: 14, color: Colors.textMuted, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { color: '#0f172a', fontWeight: 'bold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 24, paddingHorizontal: 20 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#334155' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  promoCard: { backgroundColor: Colors.primary, padding: 16, borderRadius: 16, marginBottom: 8 },
  promoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  promoTitle: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  promoSub: { color: '#0f172a', opacity: 0.8, fontSize: 12 },
  applyBtn: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  sectionTitleBlack: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 10 },
  inputLabelDark: { fontSize: 12, fontWeight: 'bold', color: '#0f172a', marginBottom: 4, marginTop: 8 },
  inputLight: { backgroundColor: 'white', borderRadius: 8, padding: 10, color: '#0f172a' },
  actionBtn: { padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuContainer: { paddingHorizontal: 20 },
  sectionHeader: { color: Colors.textMuted, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 10, gap: 12 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: 'white', fontSize: 16, fontWeight: '500' },
  menuSubLabel: { color: Colors.textMuted, fontSize: 12 },
  versionText: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 20, marginBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { backgroundColor: '#334155', padding: 8, borderRadius: 20 },
  modalBody: { gap: 16 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', height: 50 },
  modalInput: { flex: 1, color: 'white', paddingHorizontal: 12, fontSize: 16, height: '100%' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', backgroundColor: '#0f172a' },
  genderChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  genderText: { color: Colors.textMuted, fontSize: 14 },
  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  statusTitle: { fontWeight: 'bold', fontSize: 16 },
  statusSub: { color: Colors.textMuted, fontSize: 12 },
});