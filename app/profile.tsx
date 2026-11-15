import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '../components/Reveal';
import { TabBar, useTabBarHeight } from '../components/TabBar';
import {
  Avatar,
  AvatarStack,
  CatalogMark,
  Chip,
  Eyebrow,
  LinkAction,
  PillButton,
  Tap,
} from '../components/ui';
import { ChevronRight, Close, Minus, Person, Plus } from '../components/icons';
import { authMessage, signOutAccount, updateAccountName, useAuth } from '../lib/auth';
import { syncBands } from '../lib/bandSync';
import { acceptInvite, declineInvite, subscribeMyInvites } from '../lib/invites';
import { acceptSharedSong, declineSharedSong, subscribeSongsForMe } from '../lib/shares';
import { catalogCounts, countsLabel, useStore } from '../lib/store';
import { font, palette, radius } from '../lib/theme';
import { ROLE_LABELS, bandRoleOf, type Invite, type SongShare } from '../lib/types';

/**
 * Profile: who you are, the bands you're in, and the handful of reading
 * settings that change how every chart renders. Nothing here is per-song —
 * transposition and text size for one chart live in the viewer.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabHeight = useTabBarHeight();

  const settings = useStore((state) => state.settings);
  const setSettings = useStore((state) => state.setSettings);
  const catalogs = useStore((state) => state.catalogs);
  const songs = useStore((state) => state.songs);
  const setlists = useStore((state) => state.setlists);

  const account = useAuth((state) => state.account);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [received, setReceived] = useState<SongShare[]>([]);
  const [nameDraft, setNameDraft] = useState(account?.name ?? '');

  useEffect(() => subscribeMyInvites(setInvites), [account?.uid]);
  useEffect(() => subscribeSongsForMe(setReceived), [account?.uid]);
  useEffect(() => setNameDraft(account?.name ?? ''), [account?.uid, account?.name]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed === (account?.name ?? '')) return;
    updateAccountName(trimmed).catch((problem) => setSyncNote(authMessage(problem)));
  };

  const bands = catalogs.filter((catalog) => catalog.kind === 'band');

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top, backgroundColor: palette.bg }} />
      <Reveal style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: tabHeight + 12,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Eyebrow style={styles.groupLabel}>Account</Eyebrow>
        <View style={styles.group}>
          {account ? (
            <>
              <View style={styles.settingRow}>
                <Avatar name={nameDraft || account.email || '?'} size={40} letters={2} />
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onBlur={commitName}
                    onSubmitEditing={commitName}
                    placeholder={account.email || 'Il tuo nome'}
                    placeholderTextColor={palette.textGhost}
                    autoCapitalize="words"
                    returnKeyType="done"
                    accessibilityLabel="Il tuo nome"
                    style={styles.settingLabel}
                  />
                  <Text style={styles.settingHint}>
                    {songs.length} brani · {setlists.length} scalette
                  </Text>
                </View>
              </View>
              <Tap
                onPress={async () => {
                  setSyncNote('Sincronizzo…');
                  try {
                    const { pulled } = await syncBands();
                    setSyncNote(pulled > 0 ? `Recuperate ${pulled} band` : 'Tutto aggiornato');
                  } catch (problem) {
                    setSyncNote(authMessage(problem));
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Sincronizza le band"
                style={styles.settingRow}
              >
                <Text style={[styles.settingLabel, { flex: 1 }]}>Sincronizza ora</Text>
                <ChevronRight size={17} color={palette.textGhost} strokeWidth={1.6} />
              </Tap>
              <Tap
                onPress={() => {
                  signOutAccount().catch(() => {});
                  setSyncNote(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Esci dall’account"
                style={styles.settingRow}
              >
                <Text style={[styles.settingLabel, { flex: 1, color: palette.accent }]}>Esci</Text>
              </Tap>
            </>
          ) : (
            <Tap
              onPress={() => router.push('/account')}
              accessibilityRole="button"
              accessibilityLabel="Accedi o registrati"
              style={styles.settingRow}
            >
              <Person size={18} color={palette.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Accedi o registrati</Text>
                <Text style={styles.settingHint}>Per ritrovare le tue band su ogni dispositivo</Text>
              </View>
              <ChevronRight size={17} color={palette.textGhost} strokeWidth={1.6} />
            </Tap>
          )}
          {syncNote ? <Text style={styles.settingHint}>{syncNote}</Text> : null}
        </View>

        {received.length > 0 ? (
          <>
            <Eyebrow style={styles.groupLabel}>Brani ricevuti</Eyebrow>
            <View style={styles.group}>
              {received.map((share) => (
                <View key={share.id} style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel} numberOfLines={1}>
                      {share.title}
                    </Text>
                    <Text style={styles.settingHint} numberOfLines={1}>
                      {[share.artist, `da ${share.fromName || 'un musicista'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <PillButton
                    label="Aggiungi"
                    onPress={async () => {
                      const result = await acceptSharedSong(share);
                      setSyncNote(
                        result.ok
                          ? `“${share.title}” è nel tuo catalogo.`
                          : result.reason
                      );
                    }}
                  />
                  <Tap
                    onPress={() => void declineSharedSong(share)}
                    accessibilityRole="button"
                    accessibilityLabel={`Rifiuta ${share.title}`}
                    hitSlop={8}
                  >
                    <Close size={17} color={palette.textFaint} />
                  </Tap>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.groupHead}>
          <Eyebrow>Le tue band</Eyebrow>
          <LinkAction label="Nuova" onPress={() => router.push('/band/new')} />
        </View>
        <View style={styles.group}>
          {invites.map((invite) => (
            <View key={invite.id} style={[styles.bandRow, styles.inviteRow]}>
              <CatalogMark
                name={invite.bandName}
                color={invite.bandColor}
                kind="band"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.bandName} numberOfLines={1}>
                  {invite.bandName}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {invite.invitedByName
                    ? `Invito da ${invite.invitedByName} · ${ROLE_LABELS[invite.role].toLowerCase()}`
                    : `Invito come ${ROLE_LABELS[invite.role].toLowerCase()}`}
                </Text>
              </View>
              <PillButton
                label="Entra"
                onPress={async () => {
                  const outcome = await acceptInvite(invite);
                  if (outcome.ok) {
                    await syncBands().catch(() => undefined);
                    setSyncNote(`Sei entrato in “${invite.bandName}”.`);
                  } else {
                    setSyncNote(outcome.reason);
                  }
                }}
              />
              <Tap
                onPress={() => void declineInvite(invite)}
                accessibilityRole="button"
                accessibilityLabel={`Rifiuta invito da ${invite.bandName}`}
                hitSlop={8}
              >
                <Close size={17} color={palette.textFaint} />
              </Tap>
            </View>
          ))}

          {bands.map((catalog) => {
            const role = bandRoleOf(catalog, account?.uid ?? null);

            return (
              <Tap
                key={catalog.id}
                onPress={() => router.push(`/band/${catalog.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Gestisci ${catalog.name}`}
                style={styles.bandRow}
              >
                <CatalogMark name={catalog.name} color={catalog.color} kind={catalog.kind} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bandName} numberOfLines={1}>
                    {catalog.name}
                  </Text>
                  <Text style={styles.meta}>
                    {role && role !== 'owner' ? `${ROLE_LABELS[role]} · ` : ''}
                    {countsLabel(catalogCounts(catalog.id, songs, setlists))}
                  </Text>
                </View>
                <AvatarStack members={catalog.members} />
              </Tap>
            );
          })}
        </View>

        <Eyebrow style={styles.groupLabel}>Nomi degli accordi</Eyebrow>
        <View style={styles.chipRow}>
          <Chip
            label="C  D  E"
            active={settings.notation === 'anglo'}
            onPress={() => setSettings({ notation: 'anglo' })}
          />
          <Chip
            label="Do  Re  Mi"
            active={settings.notation === 'italiano'}
            onPress={() => setSettings({ notation: 'italiano' })}
          />
        </View>

        <Eyebrow style={styles.groupLabel}>Lettura</Eyebrow>
        <View style={styles.group}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Dimensione del testo</Text>
              <Text style={styles.settingHint}>
                {Math.round(settings.fontScale * 100)}% della misura di stampa
              </Text>
            </View>
            <Tap
              onPress={() =>
                setSettings({
                  fontScale: Math.max(0.7, Math.round((settings.fontScale - 0.1) * 10) / 10),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Riduci il testo"
              style={styles.stepperKey}
            >
              <Minus size={17} color={palette.text} />
            </Tap>
            <Tap
              onPress={() =>
                setSettings({
                  fontScale: Math.min(1.8, Math.round((settings.fontScale + 0.1) * 10) / 10),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Ingrandisci il testo"
              style={styles.stepperKey}
            >
              <Plus size={17} color={palette.text} />
            </Tap>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Dimensione degli accordi</Text>
              <Text style={styles.settingHint}>
                {Math.round((settings.chordScale ?? 1) * 100)}% della misura di stampa
              </Text>
            </View>
            <Tap
              onPress={() =>
                setSettings({
                  chordScale: Math.max(
                    0.7,
                    Math.round(((settings.chordScale ?? 1) - 0.1) * 10) / 10
                  ),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Riduci gli accordi"
              style={styles.stepperKey}
            >
              <Minus size={17} color={palette.text} />
            </Tap>
            <Tap
              onPress={() =>
                setSettings({
                  chordScale: Math.min(
                    1.8,
                    Math.round(((settings.chordScale ?? 1) + 0.1) * 10) / 10
                  ),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Ingrandisci gli accordi"
              style={styles.stepperKey}
            >
              <Plus size={17} color={palette.text} />
            </Tap>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Mostra gli accordi</Text>
              <Text style={styles.settingHint}>Toglili per leggere solo il testo</Text>
            </View>
            <Switch
              value={settings.showChords}
              onValueChange={(showChords) => setSettings({ showChords })}
              trackColor={{ true: palette.accent, false: palette.surfaceControlHi }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Tieni acceso lo schermo</Text>
              <Text style={styles.settingHint}>Utile sul palco e in sala prove</Text>
            </View>
            <Switch
              value={settings.keepAwake}
              onValueChange={(keepAwake) => setSettings({ keepAwake })}
              trackColor={{ true: palette.accent, false: palette.surfaceControlHi }}
            />
          </View>
        </View>

        <Eyebrow style={styles.groupLabel}>Editor</Eyebrow>
        <View style={styles.group}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Numeri Nashville</Text>
              <Text style={styles.settingHint}>
                Il grado sopra gli accordi della tonalità: 1, 2m, 4, 5
              </Text>
            </View>
            <Switch
              value={settings.nashville}
              onValueChange={(nashville) => setSettings({ nashville })}
              trackColor={{ true: palette.accent, false: palette.surfaceControlHi }}
            />
          </View>
        </View>

      </ScrollView>
      </Reveal>

      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
  },
  groupLabel: {
    marginBottom: 9,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  group: {
    gap: 8,
    marginBottom: 22,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 22,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inviteRow: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  bandName: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLabel: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
    padding: 0,
  },
  settingHint: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
  },
  stepperKey: {
    width: 34,
    height: 34,
    borderRadius: radius.pillule,
    backgroundColor: palette.surfaceControlHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    overflow: 'hidden',
  },
});
