import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// A4 poziomo w punktach (1/72 cala)
const A4_POZIOMO = { width: 842, height: 595 };

/** 🖨️ Systemowe okno drukowania Androida (drukarka albo „Zapisz jako PDF”). */
export async function drukuj(html: string): Promise<void> {
  await Print.printAsync({ html, orientation: Print.Orientation.landscape, ...A4_POZIOMO });
}

/** Tworzy plik PDF na tablecie (bez internetu) i zwraca jego adres. */
export async function utworzPdf(html: string, nazwa: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html, ...A4_POZIOMO });
  const cel = new File(Paths.cache, nazwa);
  if (cel.exists) cel.delete();
  await new File(uri).move(cel);
  return cel.uri;
}

/** 📤 „Zapisz / wyślij”: menu Androida — Dysk Google, WhatsApp, e-mail, Pliki, drukarka. */
export async function udostepnij(html: string, nazwa: string): Promise<void> {
  const uri = await utworzPdf(html, nazwa);
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: nazwa });
}
