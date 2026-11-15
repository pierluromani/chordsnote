# ChordsNote

Catalogo dinamico di testi e accordi per chi suona: cataloghi personali e di
band, trasposizione al volo, testo e accordi modificabili in modo indipendente,
scalette condivise.

App React Native / Expo (SDK 57), archivio locale sul dispositivo.

## Avvio

```bash
npm install
npx expo start
```

Poi `i` per iOS, `a` per Android, `w` per il browser.

## Com'è fatta

```
app/                    schermate (expo-router)
  index.tsx             Home: catalogo generale, cataloghi personali e band
  search.tsx            Cerca: ricerca incrementale su tutti i cataloghi
  setlists.tsx          Scalette: tutte le scalette, per data
  profile.tsx           Profilo: band, notazione, impostazioni di lettura
  catalog/[id].tsx      Lista canzoni: ricerca, indice A–Z, filtri
  setlist/[id].tsx      Scaletta: ordine, note fra i brani, avvio del set
  song/[id]/index.tsx   Viewer: la schermata principale
  song/[id]/edit.tsx    Editor: Testo · Accordi · Struttura · Dinamica
components/
  ChordLine.tsx         una riga di testo con gli accordi sulle sillabe
  ChordPicker.tsx       inserimento accordo (gradi della tonalità + griglia)
  SongList.tsx          lista raggruppata per iniziale + indice A–Z
  Sheet.tsx             il foglio modale (unica superficie sovrapposta)
  TabBar.tsx            le quattro destinazioni di partenza
  icons.tsx             set di icone disegnate a mano (SVG)
lib/
  theme.ts              i token della direzione "Palco"
  chords.ts             parsing, trasposizione, notazione anglo/italiana
  syllables.ts          divisione in sillabe e riposizionamento delle ancore
  chordpro.ts           import ed export ChordPro / testo con accordi
  store.ts              stato e persistenza (zustand + AsyncStorage)
```

## La direzione visiva: "Palco"

Tema chiaro ad alto contrasto pensato per l'uso live: leggibile sotto i fari,
nessuna grande campitura scura che rifletta, testo grande, cromatura minima.

**Un solo rosso, un solo ambra.** Il rosso `#D93A2B` porta ogni azione e ogni
accordo. L'ambra è riservata esclusivamente alle note di dinamica ("carica ·
entra batteria · cori"): appena vedi l'ambra sai che stai leggendo
un'indicazione d'esecuzione e non la canzone.

**Tre famiglie, tre ruoli.** Sora per titoli, testo delle canzoni ed etichette
dei pulsanti; Hanken Grotesk per metadati, label maiuscole e note di dinamica in
corsivo; JetBrains Mono per accordi, numerazione e indice A–Z — dove la
larghezza fissa aiuta l'occhio a scorrere.

**Gli accordi stanno su una sillaba, non su una parola.** Ogni riga è una fila
di colonne allineate in basso: sopra un box di altezza fissa con l'accordo,
sotto il frammento di testo. Dove il frammento non ha accordo il box resta
presente ma vuoto, così la baseline non si muove mai. Niente spaziatura
monospaziata, quindi il pattern regge al variare della dimensione del testo.

## Note tecniche

- **Trasposizione**: offset in semitoni applicato in fase di rendering, mai una
  riscrittura dei dati. Le tonalità di arrivo escono da una tabella canonica,
  quindi Mi +2 dà Fa♯m (tre diesis) e non Solbm. Pressione prolungata sullo
  stepper per azzerare.
- **Modifica del testo**: le ancore degli accordi vengono rimappate confrontando
  prefisso e suffisso comuni, così correggere un refuso non azzera la riga. Nel
  modo *Testo* gli accordi restano visibili: si apre una riga alla volta.
- **Righe strumentali**: una riga senza parole diventa una battuta di soli
  accordi (intro, giro, stacco).
- **Scalette**: le note ("cambio chitarra · accordare in Drop D") vivono *fra*
  le card, non dentro, perché appartengono all'intervallo fra due brani.
- **Import/export**: ChordPro (`.cho`) e testo con accordi allineati (`.txt`),
  via appunti o condivisione di sistema.
- **Notazione**: `C D E` o `Do Re Mi`, dal profilo. Il picker accetta entrambe
  anche digitando a mano.

## Scostamenti dal design handoff

- La **tab bar** è specificata con fondo `rgba(14,21,18,0.94)`, un residuo delle
  esplorazioni scure che le schermate di riferimento contraddicono: è costruita
  sul fondo caldo del resto della direzione.
- Le **ombre** (`0 12px 26px rgba(0,0,0,0.45)`, `0 20px 44px rgba(0,0,0,0.6)`)
  su questo quasi-bianco caldo leggerebbero come fuliggine: opacità ridotta e
  colore riscaldato per corrispondere alle schermate.
- Il **riordino** della scaletta usa frecce su/giù invece del trascinamento:
  stesso risultato, senza dipendenze aggiuntive.

## Verifiche

```bash
npx tsc --noEmit                      # tipi
npx expo export --platform ios        # build del bundle
```
