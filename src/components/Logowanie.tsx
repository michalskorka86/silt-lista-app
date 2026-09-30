import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { BladPolaczenia, BladSerwera } from '@/sync/klient';
import { useSync } from '@/sync/SyncProvider';
import { useMotyw } from '@/theme/motyw';

/** Logowanie tabletu hasłem — wygląd jak auth_lista.php z v19. Raz na tablecie, potem pamięta. */
export function Logowanie() {
  const { c } = useMotyw();
  const { zaloguj } = useSync();
  const [haslo, setHaslo] = useState('');
  const [blad, setBlad] = useState('');
  const [czeka, setCzeka] = useState(false);

  const wyslij = async () => {
    if (!haslo || czeka) return;
    setCzeka(true);
    setBlad('');
    try {
      await zaloguj(haslo);
    } catch (e) {
      if (e instanceof BladPolaczenia) setBlad('Brak internetu. Logowanie wymaga połączenia — spróbuj na Wi-Fi albo LTE.');
      else if (e instanceof BladSerwera) setBlad(e.message);
      else setBlad('Nie udało się zalogować. Spróbuj ponownie.');
    } finally {
      setCzeka(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.logo, { color: c.accent }]}>SILT</Text>
        <Text style={[styles.opis, { color: c.text2 }]}>
          Podaj hasło, żeby odblokować listę na tym tablecie.{'\n'}Tablet zapamięta logowanie.
        </Text>
        <TextInput
          value={haslo}
          onChangeText={setHaslo}
          onSubmitEditing={wyslij}
          placeholder="Hasło"
          placeholderTextColor={c.text3}
          secureTextEntry
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          editable={!czeka}
          style={[styles.input, { backgroundColor: c.surface2, borderColor: c.border, color: c.text }]}
        />
        <Pressable
          onPress={wyslij}
          disabled={!haslo || czeka}
          style={({ pressed }) => [styles.btn, { backgroundColor: c.accent, opacity: !haslo || czeka ? 0.4 : pressed ? 0.8 : 1 }]}>
          {czeka ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Zaloguj</Text>}
        </Pressable>
        <Text style={[styles.err, { color: c.red }]}>{blad}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: 18, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'stretch' },
  logo: { fontFamily: Fonts.black, fontSize: 52, letterSpacing: -3, lineHeight: 56, textAlign: 'center' },
  opis: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, marginBottom: 20 },
  input: { padding: 16, fontSize: 18, borderRadius: 12, borderWidth: 2, textAlign: 'center', fontFamily: Fonts.medium },
  btn: { marginTop: 12, padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 17, fontFamily: Fonts.extrabold },
  err: { fontFamily: Fonts.semibold, fontSize: 14, marginTop: 12, minHeight: 18, textAlign: 'center' },
});
