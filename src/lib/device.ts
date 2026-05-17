const DEVICE_KEY = 'device_fingerprint';

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDeviceFingerprint() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = generateId();
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

export function getDeviceName() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || 'Unknown OS';
  if (/iphone|ipad|android/i.test(ua)) return `Mobile ${platform}`;
  if (/mac/i.test(platform)) return 'Browser on macOS';
  if (/win/i.test(platform)) return 'Browser on Windows';
  return `Browser on ${platform}`;
}

export const DEFAULT_AUTH_CLIENT = {
  client_id: 'web_portal',
  grant_type: 'password',
  channel: 'web',
};
