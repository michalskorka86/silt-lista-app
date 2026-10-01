import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Dłuższy bok po zmniejszeniu — wystarczy do odczytu pisma, a zdjęcie idzie szybko nawet przy słabym zasięgu. */
const MAKS_BOK = 1800;

export type Zdjecie = { uri: string; base64: string };

/** 📷 aparat albo 🖼️ galeria → zmniejszone zdjęcie JPEG (base64). null = anulowano. Rzuca Error z opisem po polsku. */
export async function wezZdjecie(zrodlo: 'aparat' | 'galeria'): Promise<Zdjecie | null> {
  if (zrodlo === 'aparat') {
    const z = await ImagePicker.requestCameraPermissionsAsync();
    if (!z.granted) throw new Error('Brak zgody na aparat — włącz ją w ustawieniach tabletu (Aplikacje → SILT Lista → Uprawnienia).');
  }
  const opcje: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const r = zrodlo === 'aparat' ? await ImagePicker.launchCameraAsync(opcje) : await ImagePicker.launchImageLibraryAsync(opcje);
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width, a.height) > MAKS_BOK) ctx.resize(a.width >= a.height ? { width: MAKS_BOK } : { height: MAKS_BOK });
  const obraz = await ctx.renderAsync();
  const zapis = await obraz.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  if (!zapis.base64) throw new Error('Nie udało się przygotować zdjęcia');
  return { uri: zapis.uri, base64: zapis.base64 };
}
