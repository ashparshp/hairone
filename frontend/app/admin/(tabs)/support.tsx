import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import api from "../../../services/api";
import { MessageSquare } from "lucide-react-native";
import { FadeInView } from "../../../components/AnimatedViews";

export default function AdminSupport() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, []),
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/support/all");
      setTickets(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const openCount = tickets.filter(
    (ticket: any) => ticket.status === "open",
  ).length;
  const closedCount = tickets.length - openCount;

  const filteredTickets =
    filter === "open"
      ? tickets.filter((ticket: any) => ticket.status === "open")
      : tickets;

  const renderTicket = ({ item, index }: { item: any; index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => router.push(`/support/${item._id}` as any)}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <Text style={[styles.bizName, { color: colors.text, fontSize: 16 }]}>
            {item.subject}
          </Text>
          <Text
            style={[
              styles.status,
              {
                color:
                  item.status === "open"
                    ? colors.statusSuccess
                    : colors.textMuted,
                backgroundColor:
                  item.status === "open"
                    ? colors.statusSuccessSoft
                    : colors.surfaceSoft,
              },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text
          style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}
        >
          User: {item.userId?.name} ({item.userId?.phone})
        </Text>
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={1}>
          {item.messages[item.messages.length - 1]?.text}
        </Text>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Support Tickets
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Resolve issues fast and keep response queue under control.
      </Text>

      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Open
          </Text>
          <Text style={[styles.summaryValue, { color: colors.statusSuccess }]}>
            {openCount}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Closed
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {closedCount}
          </Text>
        </View>
      </View>

      <View style={[styles.filtersRow, { borderColor: colors.tabBarBorder }]}>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "open" && {
              borderBottomWidth: 2,
              borderBottomColor: colors.tint,
            },
          ]}
          onPress={() => setFilter("open")}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: filter === "open" ? colors.tint : colors.textMuted },
            ]}
          >
            Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === "all" && {
              borderBottomWidth: 2,
              borderBottomColor: colors.tint,
            },
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: filter === "all" ? colors.tint : colors.textMuted },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredTickets}
          renderItem={renderTicket}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 20 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 50, opacity: 0.5 }}>
              <MessageSquare size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>
                No tickets.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: { fontSize: 12, fontWeight: "600" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

  filtersRow: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 8 },
  filterTab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  filterTabText: { fontSize: 13, fontWeight: "700" },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: "bold", fontSize: 18 },
  status: {
    fontSize: 10,
    fontWeight: "bold",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
});
