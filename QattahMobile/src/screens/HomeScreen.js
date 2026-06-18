import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { getSessions } from '../api/client';

const PURPLE = '#7C3AED';

function StatusBadge({ status }) {
  const isOpen = status === 'collecting';
  return (
    <View style={[styles.badge, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
      <Text style={[styles.badgeText, { color: isOpen ? '#059669' : '#D97706' }]}>
        {isOpen ? '🟢 مفتوح' : '🔒 مغلق'}
      </Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await getSessions();
      setSessions(data);
      setError(null);
    } catch {
      setError('تعذّر الاتصال بالسيرفر. تحقق من الرابط في الإعدادات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const activeCount = sessions.filter(s => s.status === 'collecting').length;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={PURPLE} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      {activeCount > 0 && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>
            🍔 {activeCount} طلب مفتوح الآن
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={styles.retryText}>أعد المحاولة</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={sessions}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PURPLE]} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>ما في طلبات بعد</Text>
            <Text style={styles.emptySubtext}>ابدأ طلباً من تيليقرام</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(
              item.status === 'collecting' ? 'الطلب النشط' : 'السجل',
              { sessionId: item.id }
            )}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.restaurant}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.cardApp}>{item.delivery_app || 'يدوي'}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardStat}>👥 {item.order_count} طلب</Text>
              <Text style={styles.cardTotal}>{Number(item.grand_total || 0).toFixed(2)} ريال</Text>
            </View>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleDateString('ar-SA', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeBanner: { backgroundColor: PURPLE, padding: 12, alignItems: 'center' },
  activeBannerText: { color: 'white', fontWeight: '700', fontSize: 15 },
  errorBox: { margin: 16, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14 },
  errorText: { color: '#DC2626', marginBottom: 8, textAlign: 'right' },
  retryText: { color: '#DC2626', fontWeight: '700', textAlign: 'right', textDecorationLine: 'underline' },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#7C3AED', shadowOpacity: 0.08, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', flex: 1, textAlign: 'right' },
  cardApp: { fontSize: 13, color: '#6B7280', textAlign: 'right', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStat: { fontSize: 13, color: '#6B7280' },
  cardTotal: { fontSize: 16, fontWeight: '700', color: PURPLE },
  cardDate: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 6 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  badgeOpen: { backgroundColor: '#D1FAE5' },
  badgeClosed: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 6 },
});
