import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform, SectionList, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import {
  OwnerActionButton,
  OwnerCard,
  OwnerFilterChip,
  OwnerScreen,
  OwnerScreenHeader,
  OwnerStatusBadge,
  ownerStyles,
} from '../../components/owner/OwnerUI';
import api from '../../services/api';
import { Check, Clock, Plus, User, X, Calendar as CalendarIcon, Phone } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';
import { getMyShopId } from '../../utils/shop';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Spacing } from '../../constants/Spacing';

const FILTER_LABELS: Record<string, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  history: 'History',
  custom: 'Custom',
};

export default function ShopScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeFilter, setActiveFilter] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [blockDate, setBlockDate] = useState(() => formatLocalDate(new Date()));
  const [blockTime, setBlockTime] = useState('');
  const [blockDuration, setBlockDuration] = useState('30');
  const [blockType, setBlockType] = useState<'walk-in'|'blocked'>('walk-in');
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const todayStr = formatLocalDate(new Date());

  const fetchSchedule = async () => {
    const shopId = getMyShopId(user);
    if (!shopId) return;

    try {
      const params = new URLSearchParams();

      if (activeFilter === 'today') {
        params.append('date', todayStr);
      } else if (activeFilter === 'upcoming') {
        params.append('startDate', todayStr);
      } else if (activeFilter === 'history') {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        params.append('startDate', formatLocalDate(past));
        params.append('endDate', formatLocalDate(new Date()));
      } else if (activeFilter === 'custom') {
        params.append('startDate', formatLocalDate(startDate));
        params.append('endDate', formatLocalDate(endDate));
      }

      // @ts-ignore
      const res = await api.get(`/bookings/shop/${shopId}?${params.toString()}`);
      setBookings(res.data);

      // @ts-ignore
      const shopRes = await api.get(`/shops/${shopId}`);
      setBarbers(shopRes.data.barbers);
      if (shopRes.data.barbers.length > 0 && !selectedBarberId) {
          setSelectedBarberId(shopRes.data.barbers[0]._id);
      }
    } catch (e) {
      console.log(e);
      showToast("Failed to fetch schedule", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [activeFilter, startDate, endDate]);

  const handleCreateBlock = async () => {
      if (!blockTime || !blockDuration) {
          showToast("Time and Duration are required", "error");
          return;
      }

      setSubmitting(true);
      try {
          const shopId = getMyShopId(user);
          await api.post('/bookings', {
              shopId: shopId,
              barberId: selectedBarberId,
              date: blockDate,
              startTime: blockTime,
              totalDuration: parseInt(blockDuration),
              type: blockType,
              serviceNames: [blockType === 'walk-in' ? 'Walk-in Customer' : 'Blocked Slot'],
              totalPrice: 0,
              notes: blockNotes
          });
          showToast("Slot added successfully", "success");
          setShowModal(false);
          fetchSchedule();
          setBlockTime('');
          setBlockNotes('');
      } catch (e: any) {
          showToast(e.response?.data?.message || "Failed to create slot", "error");
      } finally {
          setSubmitting(false);
      }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string, pin?: string) => {
      try {
          const payload: any = { status: newStatus };
          if (pin) payload.bookingKey = pin;

          await api.patch(`/bookings/${bookingId}/status`, payload);
          fetchSchedule();
          showToast(`Status updated to ${newStatus}`, "success");

          if (newStatus === 'checked-in') {
              setShowPinModal(false);
              setEnteredPin('');
              setCheckInBookingId(null);
              setPinError('');
          }
      } catch (e: any) {
          if (e.response?.status === 403 && pin) {
              setPinError("Incorrect PIN");
          } else {
              showToast(e.response?.data?.message || "Failed to update status", "error");
          }
      }
  };

  const confirmStatusUpdate = (bookingId: string, newStatus: string, pin?: string) => {
      const destructive = ['cancelled', 'no-show', 'completed'].includes(newStatus);
      const labels: Record<string, string> = {
          upcoming: 'approve',
          cancelled: 'cancel',
          'no-show': 'mark as no-show',
          completed: 'mark as completed',
      };

      const run = () => handleStatusUpdate(bookingId, newStatus, pin);
      if (!destructive) {
          run();
          return;
      }

      Alert.alert(
          'Confirm action',
          `Are you sure you want to ${labels[newStatus] || newStatus} this booking?`,
          [
              { text: 'No', style: 'cancel' },
              { text: 'Yes', onPress: run },
          ],
      );
  };

  const promptCheckIn = (bookingId: string) => {
      setCheckInBookingId(bookingId);
      setEnteredPin('');
      setPinError('');
      setShowPinModal(true);
  };

  const groupBookingsByDate = (items: any[]) => {
      const grouped: any = {};
      items.forEach(b => {
          if (!grouped[b.date]) grouped[b.date] = [];
          grouped[b.date].push(b);
      });

      return Object.keys(grouped).sort().map(date => ({
          title: date === todayStr ? 'Today' : date,
          data: grouped[date]
      }));
  };

  const getStatusBadge = (item: any) => {
    if (item.type === 'blocked') return { label: 'Blocked', tone: 'danger' as const };
    if (item.type === 'walk-in') return { label: 'Walk-in', tone: 'warning' as const };
    if (item.status === 'checked-in') return { label: 'Checked in', tone: 'success' as const };
    if (item.status === 'completed') return { label: 'Completed', tone: 'success' as const };
    if (item.status === 'no-show') return { label: 'No show', tone: 'danger' as const };
    if (item.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' as const };
    if (item.status === 'pending') return { label: 'Pending', tone: 'warning' as const };
    if (item.status === 'upcoming') return { label: 'Confirmed', tone: 'info' as const };
    return { label: item.status, tone: 'neutral' as const };
  };

  const renderSectionHeader = ({ section: { title } }: any) => (
      <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.text }]}>{title}</Text>
      </View>
  );

  const renderBooking = ({ item, index }: { item: any, index: number }) => {
    const status = getStatusBadge(item);

    return (
      <FadeInView delay={index * 50}>
        <OwnerCard
          style={{
            ...styles.bookingCard,
            ...(item.type === 'blocked' ? { borderColor: colors.statusDangerBorder } : {}),
          }}
        >
          <View style={styles.bookingTop}>
            <View style={[styles.timePill, { backgroundColor: colors.surfaceSoft }]}>
              <Clock size={14} color={colors.tint} />
              <Text style={[styles.timeText, { color: colors.text }]}>{item.startTime}</Text>
            </View>
            <OwnerStatusBadge label={status.label} tone={status.tone} />
            {item.totalPrice > 0 ? (
              <View style={[styles.pricePill, { backgroundColor: colors.statusSuccessSoft }]}>
                <Text style={[styles.priceText, { color: colors.statusSuccess }]}>
                  ₹{item.totalPrice}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.customerName, { color: colors.text }]}>
            {item.userId?.name || (item.type === 'blocked' ? 'Blocked Slot' : 'Guest Customer')}
          </Text>

          {item.userId?.phone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${item.userId.phone}`)}
              style={styles.phoneRow}
            >
              <Phone size={13} color={colors.tint} />
              <Text style={[styles.phoneText, { color: colors.tint }]}>{item.userId.phone}</Text>
            </TouchableOpacity>
          ) : null}

          {item.notes ? (
            <Text style={[styles.notes, { color: colors.textMuted }]}>{item.notes}</Text>
          ) : null}

          <View style={styles.barberRow}>
            <User size={13} color={colors.textMuted} />
            <Text style={[styles.barberName, { color: colors.textMuted }]}>
              {item.barberId?.name}
            </Text>
          </View>

          <View style={styles.servicesList}>
            {item.serviceNames.map((svc: string, idx: number) => (
              <Text key={idx} style={[styles.serviceItem, { color: colors.text }]}>
                {svc}
              </Text>
            ))}
          </View>

          {item.status === 'pending' ? (
            <View style={styles.actionsRow}>
              <OwnerActionButton
                label="Approve"
                tone="success"
                icon={<Check size={14} color={colors.white} />}
                onPress={() => confirmStatusUpdate(item._id, 'upcoming')}
              />
              <OwnerActionButton
                label="Reject"
                tone="danger"
                icon={<X size={14} color={colors.white} />}
                onPress={() => confirmStatusUpdate(item._id, 'cancelled')}
              />
            </View>
          ) : null}

          {item.status === 'upcoming' ? (
            <View style={styles.actionsRow}>
              <OwnerActionButton
                label="Check in"
                tone="success"
                icon={<Check size={14} color={colors.white} />}
                onPress={() => promptCheckIn(item._id)}
              />
              <OwnerActionButton
                label="No show"
                tone="neutral"
                icon={<X size={14} color={colors.text} />}
                onPress={() => confirmStatusUpdate(item._id, 'no-show')}
              />
            </View>
          ) : null}

          {item.status === 'checked-in' ? (
            <View style={styles.actionsRow}>
              <OwnerActionButton
                label="Complete"
                tone="primary"
                icon={<Check size={14} color={colors.actionPrimaryText} />}
                onPress={() => confirmStatusUpdate(item._id, 'completed')}
              />
            </View>
          ) : null}
        </OwnerCard>
      </FadeInView>
    );
  };

  return (
    <OwnerScreen>
      <OwnerScreenHeader
        title="Schedule"
        subtitle="Manage appointments"
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            style={[styles.addButton, { backgroundColor: colors.tint }]}
          >
            <Plus size={18} color={colors.actionPrimaryText} />
          </TouchableOpacity>
        }
      />

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {['today', 'upcoming', 'history', 'custom'].map(filter => (
            <OwnerFilterChip
              key={filter}
              label={FILTER_LABELS[filter]}
              active={activeFilter === filter}
              onPress={() => setActiveFilter(filter)}
            />
          ))}
        </ScrollView>

        {activeFilter === 'custom' ? (
          <View style={styles.customDates}>
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <CalendarIcon size={14} color={colors.textMuted} />
              <Text style={{ color: colors.text }}>{formatLocalDate(startDate)}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.textMuted }}>to</Text>
            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <CalendarIcon size={14} color={colors.textMuted} />
              <Text style={{ color: colors.text }}>{formatLocalDate(endDate)}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {showStartPicker ? (
        <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
                setShowStartPicker(Platform.OS === 'ios');
                if (selectedDate) setStartDate(selectedDate);
            }}
        />
      ) : null}

      {showEndPicker ? (
        <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
                setShowEndPicker(Platform.OS === 'ios');
                if (selectedDate) setEndDate(selectedDate);
            }}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.tint} />
      ) : (
        <SectionList
          sections={groupBookingsByDate(bookings)}
          keyExtractor={(item: any) => item._id}
          renderItem={renderBooking}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[
            ownerStyles.screenPadding,
            { paddingTop: 0, paddingBottom: 110 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchSchedule(); }}
              tintColor={colors.tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Clock size={44} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No bookings for this period.
              </Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      <Modal visible={showPinModal} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalBg}>
                <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Verify booking</Text>
                    {pinError ? (
                        <Text style={[styles.pinError, { color: colors.statusDanger }]}>{pinError}</Text>
                    ) : (
                        <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                          Ask the customer for their 4-digit PIN.
                        </Text>
                    )}

                    <TextInput
                      style={[
                        styles.pinInput,
                        {
                          backgroundColor: colors.surfaceSoft,
                          color: colors.text,
                          borderColor: pinError ? colors.statusDanger : colors.border,
                        },
                      ]}
                      value={enteredPin}
                      onChangeText={(t) => { setEnteredPin(t); setPinError(''); }}
                      placeholder="0000"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={4}
                    />

                    <View style={styles.modalActions}>
                        <OwnerActionButton
                          label="Cancel"
                          tone="neutral"
                          onPress={() => setShowPinModal(false)}
                        />
                        <OwnerActionButton
                          label="Verify"
                          tone="primary"
                          onPress={() => checkInBookingId && handleStatusUpdate(checkInBookingId, 'checked-in', enteredPin)}
                        />
                    </View>
                </View>
            </View>
          </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showModal} transparent animationType="slide">
          <View style={styles.modalBg}>
              <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
                  <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>Add slot</Text>
                      <TouchableOpacity onPress={() => setShowModal(false)}>
                          <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Close</Text>
                      </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                  <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'walk-in' && { backgroundColor: colors.tint }]}
                        onPress={() => setBlockType('walk-in')}
                      >
                          <Text style={[styles.segmentText, { color: colors.textMuted }, blockType === 'walk-in' && { color: colors.actionPrimaryText, fontWeight: '700' }]}>Walk-in</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'blocked' && { backgroundColor: colors.tint }]}
                        onPress={() => setBlockType('blocked')}
                      >
                          <Text style={[styles.segmentText, { color: colors.textMuted }, blockType === 'blocked' && { color: colors.actionPrimaryText, fontWeight: '700' }]}>Block time</Text>
                      </TouchableOpacity>
                  </View>

                  <View style={styles.formRow}>
                      <View style={styles.formField}>
                         <Text style={[styles.label, { color: colors.textMuted }]}>Time (HH:mm)</Text>
                         <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border }]}
                            value={blockTime}
                            onChangeText={setBlockTime}
                            placeholder="14:30"
                            placeholderTextColor={colors.textMuted}
                         />
                      </View>
                      <View style={styles.formField}>
                         <Text style={[styles.label, { color: colors.textMuted }]}>Duration (min)</Text>
                         <TextInput
                            style={[styles.input, { backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border }]}
                            value={blockDuration}
                            onChangeText={setBlockDuration}
                            keyboardType="numeric"
                         />
                      </View>
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted }]}>Assign barber</Text>
                  <View style={styles.chipRow}>
                      {barbers.map((b: any) => (
                          <TouchableOpacity
                            key={b._id}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: selectedBarberId === b._id ? colors.tint : colors.surfaceSoft,
                                borderColor: selectedBarberId === b._id ? colors.tint : colors.border,
                              },
                            ]}
                            onPress={() => setSelectedBarberId(b._id)}
                          >
                              <Text style={{ color: selectedBarberId === b._id ? colors.actionPrimaryText : colors.textMuted, fontWeight: '600' }}>
                                {b.name}
                              </Text>
                          </TouchableOpacity>
                      ))}
                  </View>

                  <Text style={[styles.label, { color: colors.textMuted }]}>Notes / customer name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border }]}
                    value={blockNotes}
                    onChangeText={setBlockNotes}
                    placeholder="Reason or name"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={[styles.modalActions, { marginTop: 20 }]}>
                      <OwnerActionButton label="Cancel" tone="neutral" onPress={() => setShowModal(false)} />
                      <OwnerActionButton
                        label="Create"
                        tone="primary"
                        onPress={handleCreateBlock}
                      />
                  </View>
                  </KeyboardAvoidingView>
                  </ScrollView>
              </View>
          </View>
      </Modal>

    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  filtersRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  customDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Spacing.round.md,
    borderWidth: 1,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookingCard: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  bookingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Spacing.round.full,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pricePill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Spacing.round.sm,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  barberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barberName: {
    fontSize: 12,
    fontWeight: '600',
  },
  servicesList: {
    gap: 2,
    marginTop: 2,
  },
  serviceItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    padding: Spacing.xl,
    borderRadius: Spacing.round.lg,
    maxHeight: '82%',
    width: '100%',
    maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalHint: {
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  pinError: {
    marginBottom: Spacing.lg,
    fontWeight: '700',
  },
  pinInput: {
    padding: Spacing.lg,
    borderRadius: Spacing.round.md,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    padding: 12,
    borderRadius: Spacing.round.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: Spacing.round.md,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Spacing.round.sm,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  formField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Spacing.round.full,
    borderWidth: 1,
  },
});
