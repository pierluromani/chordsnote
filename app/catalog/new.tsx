import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft } from '../../components/icons';
import { CatalogMark, CircleButton, Eyebrow, PrimaryButton, Tap } from '../../components/ui';
import { goBack } from '../../lib/nav';
import { useStore } from '../../lib/store';
import { catalogColors, font, palette, radius } from '../../lib/theme';

/**
 * Starting a personal catalog. Unlike a band, there's no line-up or invite
 * step — just a name and a colour to tell it apart from the others.
 */
export default function NewCatalogScreen() {
  const insets = useSafeAreaInsets();

  const catalogs = useStore((state) => state.catalogs);
  const createCatalog = useStore((state) => state.createCatalog);

  const personal = catalogs.filter((catalog) => catalog.kind === 'personal');

  const [name, setName] = useState('');
  const [color, setColor] = useState(personal.length % catalogColors.length);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const catalog = createCatalog({ name: trimmed, kind: 'personal', color });
    router.replace(`/catalog/${catalog.id}`);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack('/')}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <Text style={styles.headerTitle}>Nuovo catalogo</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <CatalogMark name={name || 'Catalogo'} color={color} kind="personal" />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>
              {name.trim() || 'Come si chiama?'}
            </Text>
            <Text style={styles.previewMeta}>Un altro posto dove tenere i tuoi brani</Text>
          </View>
        </View>

        <Eyebrow style={styles.label}>Nome</Eyebrow>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Es. Cover, Repertorio solo"
          placeholderTextColor={palette.textGhost}
          accessibilityLabel="Nome del catalogo"
          returnKeyType="done"
          onSubmitEditing={create}
          style={styles.input}
        />

        <Eyebrow style={styles.label}>Colore</Eyebrow>
        <View style={styles.swatches}>
          {catalogColors.map((entry, index) => (
            <Tap
              key={index}
              onPress={() => setColor(index)}
              accessibilityRole="button"
              accessibilityLabel={`Colore ${index + 1}`}
              accessibilityState={{ selected: color === index }}
              style={[
                styles.swatch,
                { backgroundColor: entry.tile, borderColor: entry.bar },
                color === index && styles.swatchActive,
              ]}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
        <PrimaryButton label="Crea il catalogo" onPress={create} disabled={!name.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.displaySemi,
    fontSize: 14,
    color: palette.text,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  previewName: {
    fontFamily: font.displaySemi,
    fontSize: 16,
    color: palette.text,
  },
  previewMeta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 22,
  },
  swatches: {
    flexDirection: 'row',
    gap: 9,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  swatchActive: {
    borderWidth: 3,
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.bg,
  },
});
