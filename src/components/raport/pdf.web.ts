// W przeglądarce (tylko testy na komputerze): drukowanie przez okno przeglądarki.
export async function drukuj(html: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.print();
}

export async function utworzPdf(): Promise<string> {
  throw new Error('PDF tworzy się tylko na tablecie');
}

export async function udostepnij(html: string): Promise<void> {
  await drukuj(html);
}
