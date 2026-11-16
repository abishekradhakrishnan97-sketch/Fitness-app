import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

export interface PreparedImage {
  /** Local/preview URI (file:// on native, blob/data URL on web). */
  uri: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}

export type PickResult = { ok: true; uri: string; width: number } | { ok: false; reason: 'cancelled' | 'denied' | 'error'; message?: string };

const MAX_EDGE = 1280;

/** Open the camera (or the file chooser with camera capture on web) or the photo library. */
export async function pickImage(mode: 'camera' | 'library'): Promise<PickResult> {
  try {
    if (mode === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' };
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
    const res = mode === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets?.length) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    return { ok: true, uri: a.uri, width: Math.max(a.width ?? 0, a.height ?? 0) };
  } catch (e) {
    return { ok: false, reason: 'error', message: (e as Error)?.message };
  }
}

/** Downscale to a sensible size and re-encode as JPEG (also strips EXIF/location). */
export async function prepareImage(uri: string, longestEdge: number): Promise<PreparedImage> {
  const actions = longestEdge > MAX_EDGE ? [{ resize: { width: MAX_EDGE } }] : [];
  const out = await manipulateAsync(uri, actions, { compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('Could not process the image');
  return { uri: out.uri, bytes: base64ToBytes(out.base64), mimeType: 'image/jpeg', width: out.width, height: out.height };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]+,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 64;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 64;
    const n = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (c !== 64 && o < len) out[o++] = (n >> 8) & 255;
    if (d !== 64 && o < len) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}
