import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api";
import { ChevronLeft, Calendar } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";

export default function RevenueStatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Custom Range State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [customRevenue, setCustomRevenue] = useState<number | null>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}/revenue`);
      setData(res.data);
      if (res.data.customRange) {
        setStartDate(new Date(res.data.customRange.start));
        setEndDate(new Date(res.data.customRange.end));
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateCustom = async () => {
    setLoadingCustom(true);
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}/revenue`, {
        params: { startDate: startStr, endDate: endStr },
      });
      setCustomRevenue(res.data.custom);
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingCustom(false);
    }
  };

  const onStartChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setStartDate(selectedDate);
  };

  const onEndChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const StatCard = ({ title, amount, color }: { title: string; amount: number; color: string }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: color, borderLeftWidth: 4 }]}>
      <Text style={[styles.cardTitle, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.cardAmount, { color: colors.text }]}>₹{amount?.toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Revenue Stats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SUMMARY CARDS */}
        <View style={styles.grid}>
          <StatCard title="This Week" amount={data?.weekly || 0} color="#3b82f6" />
          <StatCard title="This Month" amount={data?.monthly || 0} color="#8b5cf6" />
          <StatCard title="This Year" amount={data?.yearly || 0} color="#10b981" />
        </View>

        {/* CUSTOM RANGE SECTION */}
        <View style={[styles.customSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom Range</Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
             Calculate revenue for a specific period.
          </Text>

          <View style={styles.dateRow}>
            {/* START DATE */}
            <View style={styles.dateCol}>
              <Text style={[styles.label, { color: colors.textMuted }]}>From</Text>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: isDark ? colors.background : '#ffffff', borderColor: colors.border }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Calendar size={16} color={colors.textMuted} />
                <Text style={{ color: colors.text }}>{format(startDate, "dd MMM yyyy")}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={onStartChange}
                  maximumDate={new Date()}
                />
              )}
            </View>

            {/* END DATE */}
            <View style={styles.dateCol}>
              <Text style={[styles.label, { color: colors.textMuted }]}>To</Text>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: isDark ? colors.background : '#ffffff', borderColor: colors.border }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Calendar size={16} color={colors.textMuted} />
                <Text style={{ color: colors.text }}>{format(endDate, "dd MMM yyyy")}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={onEndChange}
                  maximumDate={new Date()}
                  minimumDate={startDate}
                />
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.calcBtn, { backgroundColor: colors.tint }]}
            onPress={calculateCustom}
            disabled={loadingCustom}
          >
            {loadingCustom ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={[styles.calcBtnText, { color: '#000000' }]}>Calculate Revenue</Text>
            )}
          </TouchableOpacity>

          {/* CUSTOM RESULT */}
          {(customRevenue !== null || data?.custom !== undefined) && (
            <View style={[styles.resultBox, { backgroundColor: isDark ? colors.background : 'rgba(245, 158, 11, 0.1)' }]}>
               <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Total Revenue</Text>
               <Text style={[styles.resultAmount, { color: colors.tint }]}>
                 ₹{(customRevenue !== null ? customRevenue : data?.custom || 0).toLocaleString()}
               </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "bold" },
  scrollContent: { padding: 20, paddingBottom: 100 },

  grid: { gap: 16, marginBottom: 30 },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  cardAmount: { fontSize: 28, fontWeight: "bold" },

  customSection: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  sectionSub: { fontSize: 12, marginBottom: 20 },

  dateRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  dateCol: { flex: 1 },
  label: { fontSize: 12, marginBottom: 6, fontWeight: "600" },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
  },

  calcBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  calcBtnText: { fontWeight: "bold", fontSize: 16 },

  resultBox: {
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
  },
  resultLabel: { fontSize: 14, marginBottom: 4 },
  resultAmount: { fontSize: 32, fontWeight: "bold" },
});
