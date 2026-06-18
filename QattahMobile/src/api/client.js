import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const DEFAULT_URL = 'http://192.168.1.1:3001';

async function getBaseUrl() {
  try {
    const stored = await AsyncStorage.getItem('apiUrl');
    return stored || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

async function api(method, path, data) {
  const base = await getBaseUrl();
  const res = await axios({ method, url: `${base}${path}`, data, timeout: 8000 });
  return res.data;
}

export const getSessions = () => api('get', '/api/sessions');
export const getSession = (id) => api('get', `/api/sessions/${id}`);
export const doneSession = (id) => api('post', `/api/sessions/${id}/done`);
export const getSettings = () => api('get', '/api/settings');
export const saveSettings = (data) => api('put', '/api/settings', data);
export const setApiUrl = (url) => AsyncStorage.setItem('apiUrl', url);
export { getBaseUrl };
