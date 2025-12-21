import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, 
  ActivityIndicator, ScrollView, Modal, Platform 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import { 
  LogOut, User, Briefcase, ChevronRight, Edit2, Heart, 
  Settings, HelpCircle, FileText, X, Clock, ShieldAlert, Mail
} from 'lucide-react-native';
import api from '../../services/api';

export default function ProfileScreen() {
  const { user, logout, login, token } = useAuth();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  
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
          setTimeout(() => {
              logout();
              showToast("Logged out successfully", "success");
          }, 500);
      }}
    ]);
  };

  const handleApply = async () => {
    if (!bizName.trim() || !ownerName.trim()) {
        showToast("Please enter Shop Name and Your Name", "error");
        return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('/admin/apply', { businessName: bizName, ownerName });
      if (token) login(token, res.data);
      showToast("Application Submitted!", "success");
      setApplying(false);
    } catch (e) {
      showToast("Application failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
      setSavingProfile(true);
      try {
          const res = await api.put('/auth/profile', { name: editName, email: editEmail, gender: editGender });
          if (token) login(token, { ...user, ...res.data });
          setEditModalVisible(false);
          showToast("Profile Updated", "success");
      } catch (e) {
          showToast("Failed to update profile", "error");
      } finally {
          setSavingProfile(false);
      }
  };

  const MenuItem = ({ icon: Icon, label, subLabel, onPress, destructive = false }: any) => (
    <TouchableOpacity style={[styles.menuItem, {backgroundColor: colors.card}]} onPress={onPress}>
      <View style={[styles.menuIconBox, destructive && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
        <Icon size={20} color={destructive ? '#ef4444' : colors.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, {color: colors.text}, destructive && { color: '#ef4444' }]}>{label}</Text>
        {subLabel && <Text style={[styles.menuSubLabel, {color: colors.textMuted}]}>{subLabel}</Text>}
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const StatBox = ({ label, value }: any) => (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, {color: colors.text}]}>{value}</Text>
      <Text style={[styles.statLabel, {color: colors.textMuted}]}>{label}</Text>
    </View>
  );

  if (isLoggingOut) return <View style={[styles.centerLoading, {backgroundColor: colors.background}]}><ActivityIndicator size="large" color={colors.tint} /><Text style={{color:colors.textMuted, marginTop:16}}>Logging out...</Text></View>;

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.background}]} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={[styles.header, {backgroundColor: colors.card}]}>
         <View style={styles.avatarContainer}>
            <View style={[styles.avatar, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0', borderColor: colors.background}]}><User size={40} color={colors.textMuted} /></View>
            <TouchableOpacity style={[styles.editAvatarBtn, {backgroundColor: colors.tint, borderColor: colors.background}]} onPress={() => setEditModalVisible(true)}><Edit2 size={12} color={theme === 'dark' ? 'black' : 'white'} /></TouchableOpacity>
         </View>
         <Text style={[styles.name, {color: colors.text}]}>{user?.name || 'Guest User'}</Text>
         {user?.email && <Text style={[styles.email, {color: colors.textMuted}]}>{user?.email}</Text>}
         <View style={[styles.roleBadge, user?.role === 'admin' ? { backgroundColor: '#ef4444' } : user?.role === 'owner' ? { backgroundColor: colors.tint } : { backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0' }]}>
            <Text style={[styles.roleText, {color: user?.role === 'owner' ? '#0f172a' : colors.text}]}>{user?.role?.toUpperCase()}</Text>
         </View>
      </View>

      <View style={styles.statsRow}>
          <StatBox value={user?.favorites?.length || 0} label="Favorites" />
          <View style={[styles.statDivider, {backgroundColor: colors.border}]} />
          <StatBox value={user?.role === 'user' ? '0' : 'N/A'} label="Bookings" />
          <View style={[styles.statDivider, {backgroundColor: colors.border}]} />
          <StatBox value={user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : '-'} label="Gender" />
      </View>

      <FadeInView>
      <View style={styles.section}>
          {user?.role === 'user' && user?.applicationStatus === 'none' && (
             <View style={[styles.promoCard, {backgroundColor: colors.tint}]}>
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
                    <Text style={[styles.statusSub, {color: colors.textMuted}]}>We are reviewing your request.</Text>
                </View>
             </View>
          )}
          {user?.applicationStatus === 'rejected' && (
             <View style={[styles.statusCard, { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <ShieldAlert size={24} color="#ef4444" />
                <View style={{flex: 1}}>
                    <Text style={[styles.statusTitle, {color: '#ef4444'}]}>Application Rejected</Text>
                    <Text style={[styles.statusSub, {color: colors.textMuted}]}>Please contact support for details.</Text>
                </View>
             </View>
          )}
      </View>
      </FadeInView>

      <View style={styles.menuContainer}>
          <Text style={[styles.sectionHeader, {color: colors.textMuted}]}>Account Settings</Text>
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
          
          <Text style={[styles.sectionHeader, {color: colors.textMuted, marginTop: 24}]}>Support</Text>
          <MenuItem icon={HelpCircle} label="Help & Support" onPress={() => {}} />
          <MenuItem icon={LogOut} label="Log Out" destructive onPress={handleLogout} />
      </View>
      <Text style={[styles.versionText, {color: colors.textMuted}]}>Version 1.0.2</Text>

      <Modal visible={editModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
                  <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, {color: colors.text}]}>Update Profile</Text>
                      <TouchableOpacity onPress={() => setEditModalVisible(false)} style={[styles.closeBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}><X size={20} color={colors.text} /></TouchableOpacity>
                  </View>
                  <View style={styles.modalBody}>
                      <Text style={[styles.label, {color: colors.textMuted}]}>Full Name</Text>
                      <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                          <User size={20} color={colors.textMuted} style={{marginLeft: 12}} />
                          <TextInput style={[styles.modalInput, {color: colors.text}]} value={editName} onChangeText={setEditName} placeholder="Your Name" placeholderTextColor={colors.textMuted} />
                      </View>
                      <Text style={[styles.label, {color: colors.textMuted}]}>Email Address</Text>
                      <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                          <Mail size={20} color={colors.textMuted} style={{marginLeft: 12}} />
                          <TextInput style={[styles.modalInput, {color: colors.text}]} value={editEmail} onChangeText={setEditEmail} placeholder="john@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" />
                      </View>
                      <Text style={[styles.label, {color: colors.textMuted}]}>Gender</Text>
                      <View style={styles.genderRow}>
                          {['male', 'female', 'other'].map(g => (
                              <TouchableOpacity key={g} style={[styles.genderChip, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}, editGender === g && {backgroundColor: colors.tint, borderColor: colors.tint}]} onPress={() => setEditGender(g as any)}>
                                  <Text style={[styles.genderText, {color: colors.textMuted}, editGender === g && {color: 'black', fontWeight: 'bold'}]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                              </TouchableOpacity>
                          ))}
                      </View>
                      <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleUpdateProfile} disabled={savingProfile}>
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
  container: { flex: 1 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, padding: 6, borderRadius: 20, borderWidth: 2 },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  email: { fontSize: 14, marginBottom: 12 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontWeight: 'bold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 24, paddingHorizontal: 20 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 24 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  promoCard: { padding: 16, borderRadius: 16, marginBottom: 8 },
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
  sectionHeader: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, marginLeft: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 10, gap: 12 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '500' },
  menuSubLabel: { fontSize: 12 },
  versionText: { textAlign: 'center', fontSize: 12, marginTop: 20, marginBottom: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 8, borderRadius: 20 },
  modalBody: { gap: 16 },
  label: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, height: 50 },
  modalInput: { flex: 1, paddingHorizontal: 12, fontSize: 16, height: '100%' },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  genderChipActive: { },
  genderText: { fontSize: 14 },
  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  statusTitle: { fontWeight: 'bold', fontSize: 16 },
  statusSub: { fontSize: 12 },
});
