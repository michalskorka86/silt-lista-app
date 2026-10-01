import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

/** Podgląd raportu (HTML) na tablecie — można powiększać palcami. */
export function PodgladHtml({ html }: { html: string }) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={styles.web}
      scalesPageToFit
      setBuiltInZoomControls
      setDisplayZoomControls={false}
      javaScriptEnabled={false}
    />
  );
}

const styles = StyleSheet.create({ web: { flex: 1, backgroundColor: '#52525b' } });
