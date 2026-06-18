import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { getSettings, saveSettings, setApiUrl, getBaseUrl } from '../api/client';

const PURPLE = '#7C3AED';

function Field({ label, value, onChange, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        textAlign="right"
        autoCapitalize="none"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiUrl, setApiUrlState] = useState('');
  const [stcpay, setStcpay] = useState('');
  const [iban, setIban] = useState('');
  const [accountName, setAccountName] = useState('');
  const [claudeKey, setClaudeKey] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const currentUrl = await getBaseUrl();
        setApiUrlState(currentUrl);
        const s = await getSettings();
        setStcpay(s.stcpay_number || '');
        setIban(s.iban || '');
        setAccountName(s.account_name || '');
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setApiUrl(apiUrl.trim());
      await saveSettings({
        stcpay_number: stcpay.trim(),
        iban: iban.trim(),
        account_name: accountName.trim(),
        ...(claudeKey.trim() ? { claude_api_key: claudeKey.trim() } : {}),
      });
      Alert.alert('✅ تم الحفظ', 'تم حفظ الإعدادات بنجاح.');
    } catch {
      Alert.alert('❌ خطأ', 'تعذّر الاتصال بالسيرفر. تحقق من رابط API.');
    }
    setSaving(false);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={PURPLE} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 رابط السيرفر</Text>
          <Text style={styles.sectionHint}>رابط جهاز الكمبيوتر اللي شغّل البوت (نفس الشبكة)</Text>
          <Field label="API URL" value={apiUrl} onChange={setApiUrlState} placeholder="http://192.168.1.x:3001" keyboardType="url" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💸 معلومات الدفع</Text>
          <Text style={styles.sectionHint}>هذه المعلومات تُرسل للزملاء بعد كل طلب</Text>
          <Field label="رقم STC Pay" value={stcpay} onChange={setStcpay} placeholder="05XXXXXXXX" keyboardType="phone-pad" />
          <Field label="IBAN" value={iban} onChange={setIban} placeholder="SA0000000000000000000000" />
          <Field label="اسم صاحب الحساب" value={accountName} onChange={setAccountName} placeholder="محمد الأحمد" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Claude API</Text>
          <Text style={styles.sectionHint}>من console.anthropic.com</Text>
          <Field label="Claude API Key" value={claudeKey} onChange={setClaudeKey} placeholder="sk-ant-... (اتركه فارغاً إذا محفوظ)" secureTextEntry />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>حفظ الإعدادات</Text>}
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📱 كيف تشتغل؟</Text>
          <Text style={styles.infoText}>
            1. شغّل البوت على الكمبيوتر{'\n'}
            2. أضفه لجروب الدوام{'\n'}
            3. اكتب "نطلب من [المطعم]"{'\n'}
            4. الكل يطلب، وبعدها اكتب "تم الطلب"{'\n'}
            5. البوت يرسل للكل نصيبه بالخاص
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F3FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 4, textAlign: 'right' },
  sectionHint: { fontSize: 13, color: '#6B7280', marginBottom: 12, textAlign: 'right' },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5, textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    padding: 11, fontSize: 15, color: '#1F2937', backgroundColor: '#FAFAFA',
  },
  saveBtn: { backgroundColor: PURPLE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: 'white', fontSize: 17, fontWeight: '700' },
  infoBox: { backgroundColor: '#EDE9FE', borderRadius: 14, padding: 16, marginTop: 16 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#5B21B6', marginBottom: 8, textAlign: 'right' },
  infoText: { fontSize: 14, color: '#5B21B6', lineHeight: 24, textAlign: 'right' },
});
