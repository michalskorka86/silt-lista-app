import { createElement } from 'react';

/** Podgląd raportu w przeglądarce (tylko do testów na komputerze). */
export function PodgladHtml({ html }: { html: string }) {
  return createElement('iframe', { srcDoc: html, title: 'Raport', style: { flex: 1, border: 0, width: '100%', height: '100%', background: '#52525b' } });
}
