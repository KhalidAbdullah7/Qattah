import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { getSessions, getSession } from '../api/client';

const PURPLE = '#7C3AED';

function SessionDetailModal({ session, onClose }) {
  const orders = session.orders || [];
  const total = orders.filter(o => o.confirmed).reduce((s, o) => s + Number(o.total), 0);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>{session.restaurant}</Text>
        <Text style={styles.modalSub}>{session.delivery_app} • {new Date(session.created_at).toLocaleDateString('ar-SA')}</Text>
        <View style={styles.divider} />
        {orders.filter(o => o.confirmed).map(o => (
          <View key={o.id} style={styles.modalRow}>
            <Text style={styles.modalName}>{o.first_name || o.username}</Text>
            <Text style={styles.modalAmount}>{Number(o.total).toFixed(2)} ريال</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.modalRow}>
          <Text style={{ fontWeight: '800', color: '#1F2937' }}>الإجمالي</Text>
          <Text style={[styles.modalAmount, { fontSize: 17 }]}>{total.toFixed(2)} ريال</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data.filter(s => s.status === 'closed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openDetail(item) {
    try {
      const detail = await getSession(item.id);
      setSelected(detail);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>;

  return (
    <View style={styles.container}>
      {selected && <SessionDetailModal session={selected} onClose={() => setSelected(null)} />}
      <FlatList
        data={sessions}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PURPLE]} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>لا يوجد طلبات سابقة</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
            <View style={styles.cardRow}>
              <Text style={styles.cardTitle}>{item.restaurant}</Text>
              <Text style={styles.cardTotal}>{Number(item.grand_total || 0).toFixed(2)} ريال</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardSub}>{item.delivery_app || 'يدوي'} • {item.order_count} أشخاص</Text>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: 'white', borderRadius: 14, padding: 14, elevation: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  cardTotal: { fontSize: 15, fontWeight: '700', color: PURPLE },
  cardSub: { fontSize: 13, color: '#6B7280' },
  cardDate: { fontSize: 12, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#6B7280' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '90%', maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#1F2937' },
  modalSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  modalName: { fontSize: 15, color: '#374151' },
  modalAmount: { fontSize: 15, fontWeight: '700', color: PURPLE },
  closeBtn: { backgroundColor: PURPLE, borderRadius: 12, padding: 12, marginTop: 16, alignItems: 'center' },
  closeBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
