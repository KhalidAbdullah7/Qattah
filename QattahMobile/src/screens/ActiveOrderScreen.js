import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { getSessions, getSession } from '../api/client';

const PURPLE = '#7C3AED';

function OrderCard({ order }) {
  const items = JSON.parse(order.items || '[]');
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderName}>{order.first_name || order.username || 'مجهول'}</Text>
        <View style={styles.row}>
          {order.confirmed ? <Text style={styles.confirmedBadge}>✅ مؤكد</Text> : <Text style={styles.pendingBadge}>⏳ لم يؤكد</Text>}
          <Text style={styles.orderTotal}>{Number(order.total).toFixed(2)} ريال</Text>
        </View>
      </View>
      {items.map((item, i) => (
        <Text key={i} style={styles.orderItem}>
          • {item.name} × {item.quantity} = {(item.price * item.quantity).toFixed(2)} ريال
        </Text>
      ))}
    </View>
  );
}

export default function ActiveOrderScreen() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadActive(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const all = await getSessions();
      const active = all.find(s => s.status === 'collecting');
      if (active) {
        const detail = await getSession(active.id);
        setSession(detail);
      } else {
        setSession(null);
      }
      setError(null);
    } catch {
      setError('تعذّر الاتصال.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadActive();
    const interval = setInterval(() => loadActive(true), 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>;

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🕐</Text>
        <Text style={styles.emptyText}>ما في طلب مفتوح الآن</Text>
        <Text style={styles.emptySubtext}>ابدأ طلباً من تيليقرام</Text>
      </View>
    );
  }

  const confirmedOrders = (session.orders || []).filter(o => o.confirmed);
  const total = confirmedOrders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <View style={styles.container}>
      <View style={styles.sessionHeader}>
        <Text style={styles.restaurantName}>{session.restaurant}</Text>
        <Text style={styles.appName}>{session.delivery_app || ''}</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statNum}>{session.orders?.length || 0}</Text><Text style={styles.statLabel}>طلب</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>{total.toFixed(0)}</Text><Text style={styles.statLabel}>ريال</Text></View>
          <View style={styles.stat}><Text style={styles.statNum}>{confirmedOrders.length}</Text><Text style={styles.statLabel}>مؤكد</Text></View>
        </View>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={session.orders || []}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActive(true)} colors={[PURPLE]} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.emptySubtext}>لا يوجد طلبات بعد</Text>}
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F3FF' },
  sessionHeader: { backgroundColor: PURPLE, padding: 20 },
  restaurantName: { color: 'white', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  appName: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4, fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  stat: { alignItems: 'center' },
  statNum: { color: 'white', fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  orderCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmedBadge: { fontSize: 12, color: '#059669' },
  pendingBadge: { fontSize: 12, color: '#D97706' },
  orderTotal: { fontSize: 15, fontWeight: '700', color: PURPLE },
  orderItem: { fontSize: 13, color: '#4B5563', lineHeight: 22, textAlign: 'right' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 6, textAlign: 'center', padding: 20 },
  errorText: { color: '#DC2626', textAlign: 'center', padding: 8 },
});
