# Handoff: sezione Band + dashboard + calendario

**Goal**: Dare alle band una sezione di primo livello, una dashboard al posto del pannello di impostazioni, e un calendario con prove e concerti.

**Mockup approvato**: https://claude.ai/code/artifact/9da5d741-0002-4b87-86c2-c12fca354304

**Done**:
- Quinta tab "Band" (`components/TabBar.tsx`), icone `Band`/`Calendar`/`Settings`/`Place` (`components/icons.tsx`).
- `app/bands.tsx` è radice di sezione: titolo grande, TabBar, e `BandCard` con prossima data in rosso e badge dei non letti.
- `app/band/[id].tsx` diviso in `app/band/[id]/index.tsx` (dashboard), `settings.tsx` (la vecchia gestione, traslocata) e `calendar.tsx`.
- `BandEvent` in `lib/types.ts`, CRUD in `lib/bandEvents.ts` su `bands/{id}/events`, regole Firestore gemelle di `messages` (deployate).
- `lib/agenda.ts`: `bandAgenda` unisce eventi e scalette datate senza duplicare; `useBandPulse` in `lib/bandEvents.ts` dà prossima data + non letti a dashboard, lista e calendario.
- `components/DateTimeSheet.tsx`: `DateTimeWheels` (giorno · ora · minuti, sul `Wheel` già in casa) più lo sheet che le usa da sole. Lo sheet è collegato anche a `Setlist.date` in `app/setlist/[id].tsx`: la data della scaletta esisteva nel modello ma nessuna schermata la scriveva.
- `npx tsc --noEmit` pulito, `node scripts/check-agenda.ts` verde, build web e deploy su https://chordsnote.web.app.

**Next**: far provare dal vivo — creare una prova e un concerto, verificare che compaiano in griglia, agenda, "Prossimo impegno" e card della lista; che una scaletta datata non si duplichi; che un `viewer` non veda il "+" né la gestione; che le cinque tab non stiano strette.

**Watch out**: `app/`, `components/`, `lib/` non sono tracciati da git — sempre leggere un file prima di riscriverlo. `scripts/create-sample-data.js` e `scripts/screenshots.js` hanno errori di sintassi preesistenti: `tsc` li segnala, non sono regressioni.
