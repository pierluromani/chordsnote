import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft, ChevronRight, Check, Close, Person, Plus, Trash } from '../../../components/icons';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Sheet, SheetRow } from '../../../components/Sheet';
import {
  Avatar,
  CatalogMark,
  CircleButton,
  DashedButton,
  EmptyState,
  Eyebrow,
  PillButton,
  PrimaryButton,
  RoleChip,
  Tap,
} from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import {
  leaveBand,
  pushBand,
  removeBand,
  removeMemberRemote,
  setMemberRole,
} from '../../../lib/bandSync';
import {
  listBandInvites,
  revokeInvite,
  sendInvite,
} from '../../../lib/invites';
import { goBack } from '../../../lib/nav';
import { catalogCounts, countsLabel, useBandRole, useCatalog, useStore } from '../../../lib/store';
import { catalogColors, font, palette, radius } from '../../../lib/theme';
import {
  ROLE_BLURBS,
  ROLE_LABELS,
  memberRole,
  type BandRole,
  type Invite,
  type InvitedRole,
  type Member,
} from '../../../lib/types';

/**
 * Managing one band: what it's called, who's in it, what each of them may do,
 * and the note that says where you rehearse. What the band *does* — the
 * repertoire, the setlists, the bacheca, the calendar — is the dashboard a
 * step back; this page is only the settings behind it.
 *
 * Everything here is the owner's to change. Everyone else reads it, which is
 * why the fields become plain text rather than inputs that refuse.
 */
export default function BandSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const catalog = useCatalog(id);
  const account = useAuth((state) => state.account);
  const role = useBandRole(id);

  const songs = useStore((state) => state.songs);
  const setlists = useStore((state) => state.setlists);
  const updateCatalog = useStore((state) => state.updateCatalog);
  const deleteCatalog = useStore((state) => state.deleteCatalog);
  const addMember = useStore((state) => state.addMember);
  const removeMember = useStore((state) => state.removeMember);

  const [newMember, setNewMember] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitedRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [menuFor, setMenuFor] = useState<Member | null>(null);
  const [kickConfirm, setKickConfirm] = useState<Member | null>(null);
  const [busyMember, setBusyMember] = useState(false);

  const isOwner = role === 'owner';
  const shared = !!catalog?.ownerUid;

  const refreshInvites = useCallback(async () => {
    if (!catalog?.id || !shared || !isOwner) {
      setInvites([]);
      return;
    }
    setInvites(await listBandInvites(catalog.id));
  }, [catalog?.id, shared, isOwner]);

  useEffect(() => {
    void refreshInvites();
  }, [refreshInvites]);

  if (!catalog) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          title="Band non trovata"
          body="Forse è stata eliminata."
          action={<PillButton label="Torna alla home" onPress={() => router.replace('/')} />}
        />
      </View>
    );
  }

  const counts = countsLabel(catalogCounts(catalog.id, songs, setlists));

  /* ------------------------------------------------------------- Azioni */

  const addByName = () => {
    const name = newMember.trim();
    if (!name) return;
    addMember(catalog.id, name);
    setNewMember('');
    void pushBand({ ...useStore.getState().catalogs.find((c) => c.id === catalog.id)! });
  };

  const invite = async () => {
    setInviting(true);
    setInviteError(null);
    setInviteNotice(null);

    const outcome = await sendInvite(catalog, email, inviteRole);
    if (outcome.ok) {
      setEmail('');
      setInviteNotice(
        `Invito inviato a ${outcome.invite.email}. Comparirà nella sua app appena accede con questo indirizzo.`
      );
      await refreshInvites();
    } else {
      setInviteError(outcome.reason);
    }
    setInviting(false);
  };

  const changeRole = async (member: Member, next: InvitedRole) => {
    if (!member.uid) return;
    setBusyMember(true);
    await setMemberRole(catalog.id, member.uid, next).catch(() => undefined);
    setBusyMember(false);
    setMenuFor(null);
  };

  const kick = async (member: Member) => {
    setBusyMember(true);
    if (member.uid) await removeMemberRemote(catalog.id, member.uid).catch(() => undefined);
    else {
      removeMember(catalog.id, member.id);
      await pushBand(useStore.getState().catalogs.find((c) => c.id === catalog.id)!).catch(
        () => undefined
      );
    }
    setBusyMember(false);
    setMenuFor(null);
  };

  /** Close the member menu and ask about removing them from the band. */
  const confirmKick = (member: Member) => {
    setMenuFor(null);
    setKickConfirm(member);
  };

  const leave = async () => {
    await leaveBand(catalog.id).catch(() => undefined);
    router.replace('/');
  };

  /* --------------------------------------------------------------- Vista */

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <CircleButton label="Indietro" onPress={() => goBack(`/band/${id}`)}>
          <ChevronLeft size={18} color={palette.text} />
        </CircleButton>
        <Text style={styles.headerTitle}>Gestione band</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.identity}>
          <CatalogMark name={catalog.name} color={catalog.color} kind="band" />
          <View style={{ flex: 1 }}>
            {isOwner ? (
              <TextInput
                value={catalog.name}
                onChangeText={(name) => updateCatalog(catalog.id, { name })}
                onEndEditing={() =>
                  void pushBand(useStore.getState().catalogs.find((c) => c.id === catalog.id)!)
                }
                placeholder="Nome della band"
                placeholderTextColor={palette.textGhost}
                accessibilityLabel="Nome della band"
                style={styles.nameInput}
              />
            ) : (
              <Text style={styles.nameStatic} numberOfLines={2}>
                {catalog.name}
              </Text>
            )}
            <Text style={styles.meta}>{counts}</Text>
          </View>
        </View>

        {role && role !== 'owner' ? (
          <View style={styles.roleBanner}>
            <RoleChip role={role} />
            <Text style={styles.roleBannerText}>
              {role === 'editor'
                ? 'Puoi modificare repertorio e scalette di questa band.'
                : 'Puoi leggere repertorio e scalette. Per modificarli, chiedi il ruolo di editor.'}
            </Text>
          </View>
        ) : null}

        <Eyebrow style={styles.groupLabel}>Informazioni</Eyebrow>
        {isOwner ? (
          <TextInput
            value={catalog.description ?? ''}
            onChangeText={(description) =>
              updateCatalog(catalog.id, { description: description || undefined })
            }
            onEndEditing={() =>
              void pushBand(useStore.getState().catalogs.find((c) => c.id === catalog.id)!)
            }
            placeholder="Prove il giovedì in sala Zeta · repertorio anni 90 · due chitarre"
            placeholderTextColor={palette.textGhost}
            multiline
            textAlignVertical="top"
            accessibilityLabel="Informazioni sulla band"
            style={styles.notesInput}
          />
        ) : (
          <Text style={styles.notesStatic}>
            {catalog.description?.trim() || 'Nessuna informazione.'}
          </Text>
        )}

        {isOwner ? (
          <>
            <Eyebrow style={styles.groupLabel}>Colore</Eyebrow>
            <View style={styles.swatches}>
              {catalogColors.map((entry, index) => (
                <Tap
                  key={index}
                  onPress={() => {
                    updateCatalog(catalog.id, { color: index });
                    void pushBand({ ...catalog, color: index, updatedAt: Date.now() });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Colore ${index + 1}`}
                  accessibilityState={{ selected: catalog.color === index }}
                  style={[
                    styles.swatch,
                    { backgroundColor: entry.tile, borderColor: entry.bar },
                    catalog.color === index && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* ------------------------------------------------------ Formazione */}

        <Eyebrow style={styles.groupLabel}>{`Formazione · ${catalog.members.length}`}</Eyebrow>
        <View style={styles.group}>
          {catalog.members.map((member) => {
            const theirRole = memberRole(member);
            const isMe = !!member.uid && member.uid === account?.uid;
            const actionable = isOwner && !isMe && theirRole !== 'owner';

            return (
              <Tap
                key={member.id}
                onPress={actionable ? () => setMenuFor(member) : undefined}
                disabled={!actionable}
                accessibilityRole={actionable ? 'button' : undefined}
                accessibilityLabel={
                  actionable ? `Gestisci ${member.name}` : `${member.name}, ${ROLE_LABELS[theirRole]}`
                }
                style={styles.memberRow}
              >
                <Avatar name={member.name} color={member.color} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                    {isMe ? ' · tu' : ''}
                  </Text>
                  <Text style={styles.memberMeta} numberOfLines={1}>
                    {member.uid ? (member.email ?? 'Con account') : 'Segnato a mano, senza account'}
                  </Text>
                </View>
                <RoleChip role={theirRole} muted={!member.uid} />
                {actionable ? (
                  <ChevronRight size={16} color={palette.textGhost} strokeWidth={1.6} />
                ) : null}
              </Tap>
            );
          })}

          {isOwner ? (
            <View style={styles.inviteRow}>
              <TextInput
                value={newMember}
                onChangeText={setNewMember}
                placeholder="Segna un nome, senza invito"
                placeholderTextColor={palette.textGhost}
                onSubmitEditing={addByName}
                returnKeyType="done"
                accessibilityLabel="Segna un nome nella formazione"
                style={styles.inviteInput}
              />
              <Tap
                onPress={addByName}
                accessibilityRole="button"
                accessibilityLabel="Aggiungi alla formazione"
                style={styles.inviteButton}
              >
                <Plus size={17} color={palette.accentInk} strokeWidth={2.4} />
              </Tap>
            </View>
          ) : null}
        </View>

        {/* ---------------------------------------------------------- Inviti */}

        {isOwner ? (
          <>
            <Eyebrow style={styles.groupLabel}>Invita nella band</Eyebrow>

            {!shared ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Questa band vive soltanto su questo dispositivo. Accedi al tuo account per
                  condividerla e invitare chi suona con te.
                </Text>
                <PillButton label="Accedi" onPress={() => router.push('/account')} />
              </View>
            ) : (
              <View style={styles.group}>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    setInviteError(null);
                    setInviteNotice(null);
                  }}
                  placeholder="email@esempio.it"
                  placeholderTextColor={palette.textGhost}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!inviting}
                  onSubmitEditing={() => void invite()}
                  returnKeyType="send"
                  accessibilityLabel="Email di chi vuoi invitare"
                  style={styles.emailInput}
                />

                <View style={styles.roleChoice}>
                  {(['editor', 'viewer'] as InvitedRole[]).map((option) => (
                    <Tap
                      key={option}
                      onPress={() => setInviteRole(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: inviteRole === option }}
                      accessibilityLabel={`${ROLE_LABELS[option]}: ${ROLE_BLURBS[option]}`}
                      style={[
                        styles.roleOption,
                        inviteRole === option && styles.roleOptionActive,
                      ]}
                    >
                      <View style={styles.roleOptionHead}>
                        <Text
                          style={[
                            styles.roleOptionTitle,
                            inviteRole === option && { color: palette.accent },
                          ]}
                        >
                          {ROLE_LABELS[option]}
                        </Text>
                        {inviteRole === option ? (
                          <Check size={14} color={palette.accent} strokeWidth={2.4} />
                        ) : null}
                      </View>
                      <Text style={styles.roleOptionBlurb}>{ROLE_BLURBS[option]}</Text>
                    </Tap>
                  ))}
                </View>

                {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
                {inviteNotice ? <Text style={styles.notice2}>{inviteNotice}</Text> : null}

                <PrimaryButton
                  label={inviting ? 'Invio…' : 'Invia invito'}
                  onPress={() => void invite()}
                  disabled={inviting || !email.trim()}
                />

                <Text style={styles.hint}>
                  L’invito è legato all’indirizzo email, non a un account: puoi invitare anche
                  chi non si è ancora registrato: lo troverà appena entra con quell’indirizzo.
                </Text>
              </View>
            )}

            {invites.length > 0 ? (
              <>
                <Eyebrow style={styles.groupLabel}>{`In attesa · ${invites.length}`}</Eyebrow>
                <View style={styles.group}>
                  {invites.map((pending) => (
                    <View key={pending.id} style={styles.memberRow}>
                      <View style={styles.pendingMark}>
                        <Person size={15} color={palette.textFaint} strokeWidth={1.8} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {pending.email}
                        </Text>
                        <Text style={styles.memberMeta}>Invito non ancora accettato</Text>
                      </View>
                      <RoleChip role={pending.role} muted />
                      <Tap
                        onPress={async () => {
                          await revokeInvite(pending.id).catch(() => undefined);
                          await refreshInvites();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Annulla l’invito a ${pending.email}`}
                        hitSlop={10}
                      >
                        <Close size={16} color={palette.textFaint} />
                      </Tap>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {isOwner ? (
          <>
            <DashedButton
              label="Elimina la band"
              compact
              icon={<Trash size={16} color={palette.textFaint} />}
              onPress={() => setConfirmDelete(true)}
            />
          </>
        ) : role ? (
          <>
            <DashedButton
              label="Esci dalla band"
              compact
              icon={<Close size={16} color={palette.textFaint} />}
              onPress={() => setConfirmLeave(true)}
            />
          </>
        ) : null}
      </ScrollView>

      {/* Alert.alert does nothing on web, so every confirmation is a sheet. */}
      <Sheet
        visible={!!menuFor}
        onClose={() => (busyMember ? undefined : setMenuFor(null))}
        title={menuFor?.name ?? ''}
        subtitle={
          menuFor?.uid
            ? `${ROLE_LABELS[memberRole(menuFor)]} · ${ROLE_BLURBS[memberRole(menuFor)]}`
            : 'Segnato a mano nella formazione'
        }
        scroll={false}
      >
        {busyMember ? (
          <ActivityIndicator color={palette.accent} style={{ paddingVertical: 22 }} />
        ) : menuFor?.uid ? (
          <>
            {memberRole(menuFor) === 'editor' ? (
              <SheetRow
                icon={<Person size={17} color={palette.accent} strokeWidth={1.8} />}
                label="Togli i permessi di modifica"
                value="Solo lettura"
                onPress={() => void changeRole(menuFor, 'viewer')}
              />
            ) : (
              <SheetRow
                icon={<Check size={17} color={palette.accent} strokeWidth={2.2} />}
                label="Promuovi a editor"
                value="Repertorio e scalette"
                onPress={() => void changeRole(menuFor, 'editor')}
              />
            )}
            <SheetRow
              icon={<Trash size={17} color={palette.accent} />}
              label="Rimuovi dalla band"
              onPress={() => void confirmKick(menuFor)}
              danger
              last
            />
          </>
        ) : (
          <SheetRow
            icon={<Trash size={17} color={palette.accent} />}
            label="Togli dalla formazione"
            onPress={() => menuFor && confirmKick(menuFor)}
            danger
            last
          />
        )}
      </Sheet>

      <ConfirmDialog
        visible={confirmDelete}
        title="Eliminare la band?"
        message="Verranno eliminati anche i brani e le scalette, per tutti i membri. Non si può annullare."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          // Firestore first, and only then locally: once the catalog is gone
          // from the store the sync no longer knows this band is ours, and the
          // shared copy would come back at the next login.
          if (shared) void removeBand(catalog.id).catch(() => undefined);
          deleteCatalog(catalog.id);
          router.replace('/');
        }}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title="Uscire dalla band?"
        message="Il repertorio condiviso sparirà da questo dispositivo. La band resta agli altri."
        confirmLabel="Esci"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          void leave();
        }}
      />

      <ConfirmDialog
        visible={kickConfirm !== null}
        title={kickConfirm ? `Togliere ${kickConfirm.name}?` : ''}
        message={
          kickConfirm?.uid
            ? 'Perderà l’accesso al repertorio e alle scalette di questa band.'
            : 'Verrà tolto dalla formazione della band.'
        }
        confirmLabel="Rimuovi"
        onCancel={() => setKickConfirm(null)}
        onConfirm={() => {
          const member = kickConfirm;
          setKickConfirm(null);
          if (member) void kick(member);
        }}
      />
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  nameInput: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: -0.44,
    color: palette.text,
    padding: 0,
  },
  nameStatic: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: -0.44,
    color: palette.text,
  },
  meta: {
    fontFamily: font.meta,
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
  },
  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  roleBannerText: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textDim,
  },
  groupLabel: {
    marginBottom: 9,
  },
  group: {
    gap: 8,
    marginBottom: 22,
  },
  notesInput: {
    fontFamily: font.meta,
    fontSize: 13,
    lineHeight: 20,
    color: palette.text,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 76,
    marginBottom: 22,
  },
  notesStatic: {
    fontFamily: font.meta,
    fontSize: 13,
    lineHeight: 20,
    color: palette.textDim,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
  },
  swatches: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 22,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  swatchActive: {
    borderWidth: 3,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  memberName: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  memberMeta: {
    fontFamily: font.meta,
    fontSize: 11.5,
    color: palette.textFaint,
    marginTop: 1,
  },
  pendingMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.borderControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: palette.borderControl,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipOwner: {
    borderColor: palette.accent,
  },
  chipEditor: {
    borderColor: palette.accent,
  },
  chipText: {
    fontFamily: font.metaSemi,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: palette.textFaint,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inviteInput: {
    flex: 1,
    fontFamily: font.meta,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inviteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailInput: {
    fontFamily: font.meta,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  roleChoice: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderControl,
    borderRadius: radius.cardLg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
  },
  roleOptionActive: {
    borderColor: palette.accent,
    borderWidth: 2,
  },
  roleOptionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleOptionTitle: {
    flex: 1,
    fontFamily: font.displaySemi,
    fontSize: 13.5,
    color: palette.text,
  },
  roleOptionBlurb: {
    fontFamily: font.meta,
    fontSize: 11.5,
    lineHeight: 16,
    color: palette.textFaint,
  },
  notice: {
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 22,
  },
  noticeText: {
    fontFamily: font.meta,
    fontSize: 12.5,
    lineHeight: 18,
    color: palette.textDim,
  },
  notice2: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textDim,
  },
  error: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.accent,
  },
  hint: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textFaint,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.surface,
    borderRadius: radius.cardLg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  linkTitle: {
    fontFamily: font.displaySemi,
    fontSize: 15,
    color: palette.text,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: font.metaBold,
    fontSize: 10.5,
    color: palette.accentInk,
  },
  warning: {
    fontFamily: font.meta,
    fontSize: 12,
    lineHeight: 17,
    color: palette.accent,
    marginTop: 10,
  },
});
