# Handoff: ChordsNote — App mobile (direzione "Palco")

## Overview

ChordsNote è un'app mobile per musicisti: un catalogo dinamico di testi e accordi. L'utente gestisce più cataloghi (personale, cataloghi di band), consulta i brani trasponendo la tonalità al volo, modifica testo/accordi/struttura in modo indipendente, e organizza scalette condivise con la band.

Questo pacchetto documenta cinque schermate: **Home**, **Lista canzoni**, **Viewer canzone**, **Editor canzone**, **Scaletta**.

La direzione visiva si chiama **"Palco"**: tema chiaro ad alto contrasto nato per l'uso live (leggibile anche sotto i fari, nessun riflesso di grandi campiture scure), testo grande, cromatura minima, un unico accento rosso e un secondo colore ambra riservato esclusivamente alle note di dinamica.

## About the Design Files

I file HTML in questo bundle sono **riferimenti di design creati in HTML** — prototipi che mostrano l'aspetto e il comportamento previsti, **non codice di produzione da copiare direttamente**.

L'obiettivo è **ricreare questi design nell'ambiente del codebase di destinazione** (React Native, SwiftUI, Flutter, Kotlin/Compose, ecc.) usando i pattern, le librerie e i componenti già stabiliti in quel progetto. Se non esiste ancora un ambiente, scegliere il framework più adatto al progetto e implementare i design lì.

I file HTML usano un runtime interno di prototipazione (`support.js`, `ios-frame.jsx`): il frame iPhone e la tastiera iOS sono **solo scaffolding di presentazione**, non fanno parte del design da implementare. Va implementato esclusivamente il contenuto dello schermo.

## Fidelity

**High-fidelity (hifi).** Colori, tipografia, spaziature e gerarchia sono definitivi. La UI va ricreata fedelmente usando le librerie e i pattern del codebase. Le interazioni sono descritte ma non implementate nei prototipi (sono statici, con gli stati rilevanti mostrati come schermate separate — es. il menu opzioni del Viewer è mostrato aperto).

Target: iPhone, viewport di riferimento **393 × 852 pt** (iPhone 15 / 16). Safe area top ≈ 56 pt, bottom ≈ 30 pt.

---

## Design Tokens

### Colori

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#FAF8F6` | Fondo schermo (chiaro caldo) |
| `surface` | `#FFFFFF` | Card, righe di lista, campi |
| `surface-alt` | `#F2EFEC` | Card dell'editor (leggermente più calda di `surface`) |
| `surface-raised` | `#F7F4F2` | Sheet/menu sopraelevati, blocchi nota |
| `surface-control` | `#F0EBE7` | Pulsanti icona, chip inattivi, avatar placeholder |
| `surface-control-hi` | `#E6DFDA` | Bordo/hover dei controlli, stepper |
| `border` | `#F7F4F2` | Divisori tra sezioni di schermo |
| `border-soft` | `#FFFFFF` | Divisori tra righe di lista |
| `border-card` | `#F0EBE7` | Bordo card editor |
| `border-control` | `#E6DFDA` | Bordo pulsanti/controlli |
| `border-dashed` | `#E6DFDA` | Bordo tratteggiato pulsanti "aggiungi" |
| `accent` | `#D93A2B` | Accento primario (rosso) |
| `accent-ink` | `#FAF8F6` | Testo su fondo accento |
| `accent-deep` | `#C0301F` | Inizio gradiente hero |
| `accent-deep-2` | `#E2523C` | Fine gradiente hero |
| `accent-chord-hl` | `#F7D5CF` | Sfondo accordo selezionato (editor) |
| `accent-chord-underline` | `#FBE3DF` | Sottolineatura tratteggiata accordo editabile |
| `text-primary` | `#1A1614` | Titoli, testo canzone |
| `text-secondary` | `#3A322E` | Testo canzone in sezioni non attive |
| `text-muted` | `#6B5F59` | Icone e label dei controlli |
| `text-dim` | `#8A7C74` | Metadati (bpm, artista) |
| `text-faint` | `#9A8C84` | Label di sezione, placeholder |
| `text-fainter` | `#A79890` | Tab bar inattiva, micro-label |
| `text-ghost` | `#C9BDB6` | Chevron, lettere indice inattive, handle drag |
| `dynamics` | `#8A6420` | Testo note di dinamica (ambra) |
| `dynamics-dim` | `#B4832A` | Icona/nota di dinamica secondaria |
| `on-hero` | `#FFFFFF` | Testo sul gradiente hero |
| `on-hero-dim` | `#F5BDB4` | Testo secondario sull'hero |
| `on-hero-label` | `#F7C9C2` | Label maiuscola sull'hero |

Colori per catalogo (pastiglia icona / barra colore — coppia fondo + testo):

| Catalogo | Fondo | Testo |
|---|---|---|
| Personale | `#D93A2B` (barra) | — |
| Idee & Bozze | `#D99A2E` (barra) | — |
| I Notturni (band) | `#DCEAF2` | `#2A6A88` |
| Worship Domenica (band) | `#E6F0D4` | `#5A7A28` |
| Duo Acustico (band) | `#FADDE7` | `#9A3560` |

Avatar membri: `#C0301F`, `#2E6E8B`, `#7A5E8B` — testo `#FFFFFF`; `#F6E7C8` — testo `#1A1614`.

Overlay modale: `rgba(0,0,0,0.05)`.
Gradiente di dissolvenza sopra le barre flottanti: `linear-gradient(transparent, #FAF8F6 40%)`.

### Tipografia

Tre famiglie, ciascuna con un ruolo preciso:

- **Sora** — titoli, testo delle canzoni, etichette dei pulsanti. Pesi 400/500/600/700/800.
- **Hanken Grotesk** — metadati, label maiuscole, note di dinamica (in *italic*). Pesi 400/500/600/700.
- **JetBrains Mono** — accordi, numerazione, lettere dell'indice A–Z, testo dell'editor. Pesi 400/700.

| Ruolo | Font | Size / Line-height | Weight | Letter-spacing |
|---|---|---|---|---|
| Titolo schermata | Sora | 24–26 px / 1.2 | 700 | −0.02em |
| Titolo hero | Sora | 24 px | 700 | −0.02em |
| Titolo brano (header viewer) | Sora | 14 px | 600 | — |
| Titolo brano (editor meta) | Sora | 20 px | 500 | −0.01em |
| Titolo riga di lista | Sora | 15–16 px | 600 | — |
| **Testo canzone (viewer)** | Sora | **21 px / 29 px** | 500 | — |
| **Accordo (viewer)** | JetBrains Mono | **13 px / 18 px**, box h. 20 px | 700 | — |
| Testo canzone (editor) | JetBrains Mono | 15 px / 23 px | 400 | — |
| Accordo (editor) | JetBrains Mono | 12 px / 17 px, box h. 19 px | 700 | — |
| Label sezione (STROFA…) | Hanken Grotesk | 11–12 px | 700 | 0.16–0.18em, uppercase |
| Nota di dinamica | Hanken Grotesk *italic* | 11–12 px / 1.4–1.5 | 400 | — |
| Label maiuscola (SETLIST…) | Hanken Grotesk | 12 px | 600 | 0.05em, uppercase |
| Micro-label (TONALITÀ, BPM) | Hanken Grotesk | 9 px | 600 | 0.14em, uppercase |
| Label hero | Hanken Grotesk | 10 px | 600 | 0.2em, uppercase |
| Metadati | Hanken Grotesk | 11–13 px | 400 | — |
| Chip / filtro | Hanken Grotesk | 12 px | 600 | — |
| Pulsante primario | Sora | 14–15 px | 700 | — |
| Pulsante secondario | Sora / Hanken | 12–13 px | 600 | — |
| Tab bar | Hanken Grotesk | 10 px | 500 (600 se attiva) | — |
| Lettera indice A–Z | JetBrains Mono | 9 px | 600 | — |
| Numero in lista/scaletta | JetBrains Mono | 14–15 px | 600 | — |

### Spaziature

Scala usata: **2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 26, 30** px.

- Padding orizzontale di schermo: **18–22 px** (20 px standard; 24 px nel viewer per dare aria al testo)
- Padding top header: **56 px** (safe area)
- Padding bottom tab bar: **30 px** (safe area)
- Gap tra righe di lista/card: **7–8 px**
- Gap tra gruppi di sezione: **22 px**
- Gap tra sezioni di canzone (viewer): **26 px**
- Padding interno card: **12–16 px**

### Border radius

| Valore | Uso |
|---|---|
| 8 px | Logo app |
| 9–11 px | Pastiglie piccole, blocchi nota, campo di ricerca, stepper |
| 10 px | Pulsanti accordo della toolbar |
| 11 px | Pastiglia icona brano/catalogo (38–40 px) |
| 13–14 px | Card di lista, pulsante primario |
| 16 px | Card sezione dell'editor |
| 20 px | Hero, sheet menu opzioni |
| 999 px | Pulsanti icona, chip, avatar, pulsante flottante |

### Ombre

- Pulsante flottante / barra flottante: `0 12px 26px rgba(0,0,0,0.45)`
- Sheet menu opzioni: `0 20px 44px rgba(0,0,0,0.6)`
- Barre in overlay su contenuto scorrevole: nessuna ombra, si affidano al gradiente di dissolvenza

### Icone

Nel prototipo sono **glifi tipografici e forme CSS** (`♪ ‹ › ··· ＋ ✎ ♥ ⠿ ⇪ ≡ ↕ ✕ ▶ − +`) usati come segnaposto. **Nell'implementazione sostituirli con un set di icone reale** (SF Symbols su iOS, Material Symbols su Android, o il set già presente nel codebase). Corrispondenze suggerite:

| Glifo | Significato | SF Symbol |
|---|---|---|
| `♪` | Logo / marcatore musicale | `music.note` |
| `‹` `›` | Indietro / avanti | `chevron.left` / `chevron.right` |
| `···` | Menu opzioni | `ellipsis` |
| `＋` | Aggiungi | `plus` |
| `✎` | Modifica / nota | `pencil` |
| `♥` | Preferito | `heart.fill` |
| `⠿` | Handle di trascinamento | `line.3.horizontal` |
| `⇪` | Esporta | `square.and.arrow.up` |
| `≡` | Aggiungi a scaletta | `list.bullet` |
| `↕` | Auto-scroll | `arrow.up.arrow.down` |
| `▶` | Avvia set | `play.fill` |
| `−` `+` | Stepper trasposizione | `minus` / `plus` |

Il cerchio decorativo dell'hero è un `div` di 126 px, `border-radius: 999px`, `border: 22px solid rgba(255,255,255,0.07)`, posizionato `right: −26px; bottom: −30px`, con `overflow: hidden` sul contenitore.

---

## Il pattern chiave: accordi allineati sopra le parole

È l'elemento più importante del design e va implementato con cura.

Ogni riga di testo è un contenitore **flex, `flex-wrap: wrap`, `align-items: flex-end`**. Ogni frammento di testo è una **colonna** (`inline-flex; flex-direction: column`) che contiene due elementi:

1. l'accordo, in JetBrains Mono, con **altezza fissa** (20 px nel viewer, 19 px nell'editor) — se il frammento non ha accordo, l'elemento resta **vuoto ma presente**, così la baseline del testo non si sposta;
2. la parola o il gruppo di parole, con `white-space: pre` per preservare lo spazio finale.

Il testo va **spezzato nei punti in cui cambia l'accordo**, non parola per parola: `[G]Sotto ` / `lo ` / `[D]stesso ` / `cielo ci ` / `[Em]siamo ` / `[C]noi`. Così il wrapping avviene naturalmente e ogni accordo resta ancorato alla sillaba giusta.

Su piattaforme native questo si realizza con un layout a flusso di token (es. `Flow`/`LazyVGrid` con item a larghezza intrinseca, oppure un attributed string con baseline offset e un ruby/annotation layer). **Non usare testo monospaziato con spazi di padding**: si rompe al variare della dimensione del font e dell'accessibilità.

### Modello dati suggerito

```
Song {
  id, title, artist
  originalKey: String      // "G"
  bpm: Int                 // 92
  duration: Seconds        // 252
  sections: [Section]
}

Section {
  id
  type: enum { intro, verse, preChorus, chorus, bridge, instrumental, outro, custom }
  label: String            // "STROFA 1"
  dynamics: String?        // "carica · entra batteria · cori"
  lines: [Line]
}

Line {
  tokens: [Token]
}

Token {
  chord: String?           // "Em" — nil se il frammento non ha accordo
  text: String             // "Canta " (spazio finale incluso)
}
```

Gli accordi sono così **indipendenti dal testo**: modificare una parola non tocca gli accordi, e la trasposizione mappa solo il campo `chord`.

### Trasposizione

La trasposizione è un **offset in semitoni** applicato in fase di rendering, mai una riscrittura dei dati salvati.

- `originalKey` resta immutato nel modello.
- `transposeOffset: Int` (−11…+11) vive nello stato di visualizzazione, per brano.
- Ogni `chord` viene parsato in radice + alterazione + suffisso (`Em7`, `C/G`, `F#m`), la radice viene spostata di N semitoni, il suffisso resta intatto. Gli accordi con basso (`C/G`) trasportano anche la nota di basso.
- La scelta tra diesis e bemolle segue la tonalità di destinazione (es. E♭ maggiore usa i bemolle).
- Il capotasto è un valore separato: non altera gli accordi mostrati, informa il chitarrista di quale posizione usare. Nel design è mostrato come label a sé.

---

## Screens / Views

### 01 · Home

**Purpose** — punto di ingresso: aprire il catalogo generale, scegliere un catalogo personale o un catalogo di band.

**Layout** — colonna verticale: header fisso, contenuto scorrevole, tab bar fissa.

**Header** (padding `58px 22px 10px`, non scorre)
- Riga con `space-between`:
  - A sinistra, gruppo con gap 9 px: pastiglia logo 26 × 26 px, radius 8, fondo `accent`, glifo `♪` in Sora 800/14 px colore `accent-ink`; accanto "ChordsNote" in Sora 700/17 px, `text-primary`.
  - A destra, avatar utente 34 × 34 px, radius 999, fondo `surface-control`, bordo 1 px `border-control`, iniziali "MR" in Sora 600/12 px, `text-muted`.

**Contenuto scorrevole** (padding `8px 18px 12px`)

1. **Hero catalogo generale** — radius 20 px, `overflow: hidden`, gradiente `linear-gradient(135deg, #C0301F, #E2523C)`, padding `20px 20px 18px`, margin-bottom 22 px.
   - "CATALOGO GENERALE" — Hanken 600/10 px, tracking 0.2em, uppercase, `on-hero-label`
   - "Tutte le canzoni" — Sora 700/24 px, tracking −0.02em, bianco, margin `5px 0 3px`
   - "183 brani · da tutti i cataloghi" — Hanken 400/13 px, `on-hero-dim`
   - Due pulsanti, gap 8 px, margin-top 16 px: **Apri** (fondo `bg`, testo `accent`, Sora 700/13 px, padding `9px 15px`, radius 999) e **Cerca** (fondo `rgba(255,255,255,0.14)`, testo bianco, Sora 600/13 px)
   - Cerchio decorativo come descritto nei token

2. **"I MIEI CATALOGHI"** — label, poi due card (gap 8 px, margin-bottom 22 px). Card: fondo `surface`, radius 14 px, padding `14px 16px`, riga flex gap 14 px:
   - barra colore verticale 6 × 38 px, radius 99
   - blocco testo: nome in Sora 600/16 px `text-primary`; sotto, metadati in Hanken 400/12 px `text-dim`, margin-top 1 px
   - chevron `›` Sora 400/20 px `text-ghost`
   - Contenuto: **Personale** — "48 brani · 3 scalette", barra `#D93A2B`; **Idee & Bozze** — "9 brani", barra `#D99A2E`

3. **"CATALOGHI BAND · 3"** — label con azione "Gestisci" a destra (Hanken 600/12 px, `accent`). Tre card come sopra ma con **pastiglia icona** 38 × 38 px radius 11 al posto della barra (iniziale in Sora 700/15 px, coppia di colori da tabella), e a destra uno **stack di avatar** invece del chevron: cerchi 23 × 23 px radius 999, bordo 1.5 px colore `surface` (della card), sovrapposti con `margin-left: -7px`, iniziali Sora 600/9 px `text-primary`; l'ultimo mostra "+N" in 8 px.
   - **I Notturni** — "126 brani · 5 scalette", avatar L / G / +2
   - **Worship Domenica** — "32 brani · 2 scalette", avatar S / +5
   - **Duo Acustico** — "21 brani · 1 scaletta", avatar G singolo
   - Sotto: **＋ Nuovo catalogo** — full width, fondo trasparente, bordo 1.5 px dashed `border-dashed`, radius 14, padding 14, Sora 600/14 px `text-faint`

**Tab bar** (fissa, padding `10px 20px 30px`, fondo `rgba(14,21,18,0.94)` + `backdrop-filter: blur(8px)`, bordo superiore 1 px `border`)
- Quattro voci a larghezza uguale, ciascuna colonna centrata con gap 5 px: icona + label Hanken 10 px.
- Voci: **Cataloghi** (attiva, `accent`), **Cerca**, **Scalette**, **Profilo** (inattive, `text-fainter`).

---

### 02 · Lista canzoni

**Purpose** — trovare un brano dentro un catalogo, gestire il catalogo di band, accedere alle scalette.

**Header** (padding `56px 20px 10px`)
- Riga superiore `space-between`: pulsante indietro 36 × 36 px radius 999 fondo `surface-control`; a destra gruppo gap 8 px con **Esporta** (altezza 36, padding orizzontale 13, radius 999, fondo `surface-control`, Hanken 600/12 px `text-muted`) e pulsante `···` 36 × 36 px.
- Titolo: "I Notturni" Sora 700/25 px tracking −0.02em, accanto badge **BAND** (Hanken 700/9 px, tracking 0.1em, fondo `accent`, testo `accent-ink`, padding `3px 6px`, radius 5).
- Riga metadati, gap 9 px, separata da punti 3 × 3 px `text-ghost`: "126 brani" · stack avatar 21 px (L / G / +2) · **Invita** (Hanken 600/13 px `accent`).
- **Campo di ricerca** (margin-top 14 px): fondo `surface`, radius 12, padding `11px 13px`, icona lente 15 px + placeholder "Cerca per titolo o artista…" Hanken 400/14 px `text-faint`.
- **Chip filtro** (margin-top 11 px, gap 7 px, scroll orizzontale): **Canzoni** attiva (fondo `accent`, testo `accent-ink`), **Scalette · 5** e **Preferite** inattive (fondo `surface-control`, testo `text-muted`). Padding `6px 12px`, radius 999.

**Corpo** — riga flex a due colonne: lista scorrevole + indice alfabetico.

**Lista** (flex 1, padding `6px 6px 96px 20px`)
- Intestazioni di gruppo: lettera in JetBrains Mono 600/12 px `text-ghost`, padding `8px 0 4px` (14 px sopra dal secondo gruppo in poi).
- Riga brano: padding `11px 0`, bordo inferiore 1 px `border-soft`, flex gap 13 px:
  - pastiglia tonalità 38 × 38 px, radius 11, fondo `surface`, sigla accordo JetBrains Mono 700/13 px `accent`
  - blocco testo: titolo Sora 600/15 px `text-primary` con troncamento a una riga; artista Hanken 400/12 px `text-dim`
  - `♥` Sora 400/14 px `accent` se preferito, altrimenti niente
- Contenuto: **C** → Canto della sera (C, L. Ferri, ♥), Città vuote (Am, M. Bianchi) · **F** → Ferma il tempo (A, M. Bianchi, ♥) · **N** → Nebbia al mattino (D, G. Sarti) · **O** → Onde (C, L. Ferri) · **S** → Sotto lo stesso cielo (G, M. Bianchi, ♥)

**Indice alfabetico** (colonna 22 px, centrata verticalmente, gap 1 px, padding-bottom 96 px)
- A C D F G I L M N O P R S T V Z in JetBrains Mono 600/9 px. Lettere con brani in `accent`, le altre in `text-ghost`.
- Comportamento: trascinando il dito lungo l'indice la lista salta al gruppo corrispondente, con feedback tattile leggero a ogni cambio lettera.

**Pulsante flottante** — in basso a destra, sopra un gradiente di dissolvenza (padding `14px 20px 30px`): **＋ Nuovo brano**, fondo `accent`, testo `accent-ink` Sora 700/14 px, padding `13px 19px`, radius 999, ombra `0 12px 26px rgba(0,0,0,0.45)`.

**Opzioni di gestione band** dietro `···`: rinomina catalogo, gestisci membri e permessi, duplica catalogo, esporta tutto, archivia. **Esporta** apre la scelta del formato (PDF, ChordPro, testo semplice) e dell'ambito (brano corrente, selezione, catalogo intero).

---

### 03 · Viewer canzone

**Purpose** — leggere testo e accordi durante l'esecuzione. La schermata è volutamente spoglia: nessuna barra di strumenti permanente, tutte le azioni dietro un unico pulsante.

**Header** (padding `56px 20px 14px`, `space-between`)
- Indietro 36 × 36 px radius 999 fondo `surface-control`
- Centro: titolo "Sotto lo stesso cielo" Sora 600/14 px troncato; sotto "Tono G · 92 bpm · 4:12" Hanken 400/11 px `text-faint`
- Destra: `···` 36 × 36 px radius 999, **fondo `accent`, glifo `accent-ink` Sora 700/17 px** — è l'unico elemento colorato dell'header, così resta trovabile al buio

**Contenuto** (padding `6px 24px 40px`, scorrevole)

Per ogni sezione (gap 26 px):
1. **Intestazione**: riga `align-items: baseline` gap 9 px — label uppercase (Hanken 700/12 px, tracking 0.18em) + filetto orizzontale 1 px che occupa lo spazio residuo. Sezione corrente/ritornello: label `accent`, filetto `#FBE3DF`. Altre sezioni: label `text-faint`, filetto `border`.
2. **Nota di dinamica** (se presente): Hanken 400/11 px *italic*, `line-height 1.4`, colore `dynamics-dim` (`#B4832A`), margin `3px 0 10–12px`. È l'unica informazione non-rossa della schermata.
3. **Righe di testo con accordi** secondo il pattern descritto sopra: testo Sora 500/21 px su 29 px, accordi JetBrains Mono 700/13 px con box 20 px. Gap 8 px tra righe.
   - Sezioni **solo accordi** (intro, stacchi): riga flex con gap 22 px di sigle JetBrains Mono 700/15 px `accent`, senza testo.
   - Sezioni non attive (es. bridge finale): testo in `text-secondary` invece di `text-primary`.

Contenuto d'esempio:
- **INTRO** — *soft · solo chitarra arpeggiata* — G D Em C
- **STROFA 1** — *entra il basso · voce trattenuta* — "[G]Sotto lo [D]stesso cielo ci [Em]siamo [C]noi / [G]due voci nel [D]buio che non [C]si perdono [D]mai"
- **RITORNELLO** (evidenziata) — *carica · entra batteria · cori* — "[Em]Canta con [C]me, [G]non ti [D]lasciare / [Em]questa notte [C]sa di [D]ricominciare"
- **BRIDGE** — *tutto si ferma · solo voce e piano* — "[Am]Resta [C]ancora un [D]po'"

**Menu opzioni** (mostrato aperto nel design)
- Overlay a tutto schermo `rgba(0,0,0,0.05)`.
- Sheet ancorato in basso: `left/right 14px`, `bottom 24px`, fondo `surface-raised`, bordo 1 px `border-control`, radius 20, padding 8, ombra `0 20px 44px rgba(0,0,0,0.6)`.
- Intestazione: "Opzioni brano" Sora 700/13 px + `✕` `text-faint`, padding `10px 12px 12px`.
- **Blocco trasposizione** in evidenza: card `surface`, radius 14, padding `12px 14px`, margin-bottom 6 px. A sinistra "Trasponi" Sora 600/14 px e sotto "originale G · +0 semitoni" Hanken 400/11 px `text-dim`. A destra stepper: `−` e `+` 34 × 34 px radius 10 fondo `surface-control-hi`, con al centro la tonalità corrente in Sora 700/16 px `accent`, larghezza fissa 30 px centrata.
- **Voci di menu** in colonna, ciascuna padding `12px 14px`, bordo inferiore 1 px `#EFE9E5` (tranne l'ultima), riga flex gap 13 px: glifo in `accent` larghezza fissa 18 px + etichetta Sora 500/15 px `text-primary`.
  - ✎ Modifica brano
  - ⇪ Esporta PDF
  - ≡ Aggiungi a scaletta
  - ↕ Auto-scroll — con "92 bpm" allineato a destra in Hanken 400/12 px `text-faint`
  - A Dimensione testo

---

### 04 · Editor canzone

**Purpose** — modificare testo, accordi, struttura e note di dinamica, e impostare i metadati del brano. Testo e accordi sono editabili in modo indipendente.

**Header** (padding `56px 18px 12px`, bordo inferiore 1 px `border`)
- **Annulla** (Hanken 400/15 px `text-dim`) · centro "Modifica brano" Sora 600/14 px + "salvato 12:04" Hanken 400/11 px `text-fainter` · **Salva** (fondo `accent`, testo `accent-ink` Sora 700/13 px, padding `7px 16px`, radius 999)

**Blocco metadati** (padding `14px 18px 12px`, bordo inferiore 1 px `border`)
- Titolo brano editabile inline: Sora 500/20 px tracking −0.01em `text-primary`
- Artista: Hanken 400/13 px `text-dim`
- Tre campi a larghezza uguale, gap 8 px, margin-top 12 px. Ciascuno: fondo `surface`, radius 11, padding `8px 10px`; micro-label uppercase Hanken 600/9 px tracking 0.14em `text-fainter`; valore Sora 700/16 px.
  - **TONALITÀ** → "G" in `accent` + "orig." Hanken 400/11 px `text-faint` accanto
  - **BPM** → "92" `text-primary`
  - **DURATA** → "4:12" `text-primary`

**Tab modalità** (padding `11px 18px 10px`, gap 5 px) — chip padding `7px 13px` radius 999, Hanken 600/12 px: **Testo** attiva (`accent` / `accent-ink`), **Accordi**, **Struttura**, **Dinamica** inattive (`surface-control` / `text-muted`).
Le tab cambiano cosa è modificabile, non la struttura della pagina: in *Testo* si scrive, in *Accordi* i tap posizionano e cambiano gli accordi senza toccare le parole, in *Struttura* le sezioni si aggiungono/riordinano/rinominano, in *Dinamica* si modificano solo le note.

**Corpo** (padding `4px 18px 16px`, scorrevole) — una card per sezione, gap 10 px:
- Card: fondo `surface-alt`, bordo 1 px `border-card`, radius 16, padding `12px 13px 14px`
- Intestazione card: handle `⠿` (`text-ghost`, `cursor: grab`) + label sezione Hanken 700/11 px tracking 0.16em `accent` + spaziatore + `···` Sora 400/15 px `text-fainter`
- **Campo nota di dinamica**: fondo `surface-raised`, radius 9, padding `7px 10px`, margin-bottom 10 px; glifo `♪` `dynamics-dim` + testo Hanken 400/12 px *italic* `dynamics`
- Righe di testo con accordi (JetBrains Mono 15/23 px, accordi 12/17 px): ogni accordo modificabile porta una **sottolineatura tratteggiata 1.5 px `accent-chord-underline`**; l'accordo **selezionato** ha fondo `accent-chord-hl`, radius 4, padding orizzontale 3 px. È l'affordance che rende visibile la modificabilità indipendente degli accordi.
- Sotto tutte le card: **＋ Aggiungi sezione** full width, bordo 1.5 px dashed `border-dashed`, radius 14, padding 13, Sora 600/13 px `text-faint`

**Toolbar accordi** (sopra la tastiera, padding `9px 14px`, gap 7 px, scroll orizzontale, fondo `surface-alt`, bordo superiore 1 px `border-card`)
- **＋ Accordo** — fondo `accent`, testo `accent-ink`, JetBrains Mono 700/13 px, radius 10, padding `9px 12px`
- Accordi recenti **G D Em C** — fondo `surface-control`, bordo 1 px `border-control`, radius 10, padding `9px 13px`, JetBrains Mono 700/13 px `accent`
- **♪** — stesso stile ma testo `text-muted`: apre il selettore accordi completo

Sotto, la tastiera di sistema.

---

### 05 · Scaletta

**Purpose** — costruire l'ordine dei brani per una data, annotare indicazioni pratiche, condividere con la band, avviare il set.

**Header** (padding `56px 20px 12px`, bordo inferiore 1 px `border`)
- Riga superiore: indietro 36 × 36 px; a destra **Condividi** (altezza 36, padding orizzontale 13, radius 999, `surface-control`, Hanken 600/12 px `text-muted`) e `···` 36 × 36 px
- "SCALETTA · I NOTTURNI" — Hanken 600/10 px tracking 0.2em uppercase `accent`
- "Live @ Blue Note Club" — Sora 700/24 px, line-height 1.2, tracking −0.02em, `text-primary`, margin-top 4 px
- Metadati gap 9 px con punto separatore: "Ven 14 ago · 21:30" · "12 brani · 48 min" — Hanken 400/13 px `text-dim`
- **Nota generale**: fondo `surface-raised`, radius 11, padding `10px 12px`, margin-top 13 px; glifo `✎` `dynamics-dim` + testo Hanken 400/12 px line-height 1.5 `dynamics` — "Soundcheck alle 19:00. Set unico senza pausa, Luca parla dopo il brano 6."

**Corpo** (padding `12px 18px 100px`)
- Label "ORDINE" + azione **Riordina** (Hanken 600/12 px `accent`)
- Righe brano, gap 7 px: fondo `surface`, radius 13, padding `12px 13px`, flex gap 11 px:
  - handle `⠿` `text-ghost` `cursor: grab`
  - numero JetBrains Mono 600/14 px `accent`, larghezza fissa 16 px
  - titolo Sora 600/15 px `text-primary` troncato; sotto metadati "G · 92 bpm · 4:12" Hanken 400/11 px `text-dim`
- **Note tra i brani**: riga fuori dalle card, padding `3px 6px`, gap 9 px — glifo `✎` + testo Hanken 400/11 px *italic* `dynamics-dim` ("cambio chitarra · accordare in Drop D"). Vivono tra due elementi della lista, non dentro una card.
- I brani oltre i primi tre hanno `opacity: 0.65` (semplice indicazione di scroll nel mock, non uno stato reale).
- Due pulsanti tratteggiati full width: **＋ Aggiungi brano** e **✎ Aggiungi nota**

**Barra inferiore** — sopra un gradiente di dissolvenza (padding `14px 20px 30px`): **▶ Avvia il set** full width, fondo `accent`, testo `accent-ink` Sora 700/15 px, padding 15, radius 14, ombra `0 12px 26px rgba(0,0,0,0.45)`.

---

## Interactions & Behavior

### Navigazione

```
Home
 ├─ Hero "Apri"        → Lista canzoni (catalogo generale)
 ├─ Card catalogo      → Lista canzoni (catalogo scelto)
 └─ Tab Scalette       → Elenco scalette → Scaletta

Lista canzoni
 ├─ Riga brano         → Viewer
 ├─ Chip "Scalette"    → Elenco scalette del catalogo
 ├─ ＋ Nuovo brano     → Editor (vuoto)
 ├─ Esporta            → Foglio di scelta formato
 └─ ···                → Opzioni di gestione band

Viewer
 └─ ···                → Sheet opzioni
      ├─ stepper       → trasposizione live, resta nel viewer
      ├─ Modifica      → Editor (stesso brano)
      ├─ Esporta PDF   → foglio di esportazione
      ├─ A scaletta    → selettore scaletta
      └─ Auto-scroll   → avvia lo scorrimento

Editor
 ├─ Salva              → torna al Viewer
 └─ Annulla            → conferma se ci sono modifiche non salvate

Scaletta
 ├─ Riga brano         → Viewer in modalità set (avanti/indietro tra i brani)
 └─ Avvia il set       → Viewer sul brano 1, schermo sempre acceso
```

### Comportamenti specifici

**Trasposizione** — il tap su `−`/`+` aggiorna gli accordi immediatamente, senza ricaricare la pagina; la tonalità mostrata nello stepper e nell'header cambia di conseguenza. Il sottotitolo dello sheet mostra sempre l'originale e l'offset ("originale G · +2 semitoni"), così si sa come tornare indietro. Un tap prolungato sullo stepper azzera l'offset. L'offset è **per brano e per utente**: non altera il brano condiviso con la band.

**Auto-scroll** — velocità derivata da `bpm` e dalla lunghezza del brano, regolabile. Durante lo scorrimento, un tap sullo schermo mette in pausa; l'header si nasconde dopo 3 s di inattività e ricompare al tocco. Lo schermo resta acceso.

**Riordino** — pressione prolungata sull'handle `⠿` (o drag diretto in modalità Riordina) solleva la riga: `scale(1.02)`, ombra `0 12px 26px rgba(0,0,0,0.45)`, le altre righe si spostano con transizione 180 ms `ease-out`. Le note tra i brani seguono il brano che le precede.

**Ricerca** — filtro incrementale su titolo e artista, senza distinzione di accenti e maiuscole. A ricerca attiva l'indice A–Z si nasconde e le intestazioni di gruppo lasciano il posto a un conteggio dei risultati.

**Indice A–Z** — tap salta al gruppo; trascinamento verticale scorre tra i gruppi con feedback tattile leggero a ogni cambio.

**Sheet opzioni** — entra da sotto in 240 ms `cubic-bezier(0.32, 0.72, 0, 1)`, overlay in fade 160 ms. Si chiude con `✕`, tap sull'overlay o swipe verso il basso.

**Transizioni tra schermate** — push laterale standard della piattaforma, 300 ms.

**Stati di pressione** — ogni elemento tappabile scurisce/schiarisce dell'8 % per 100 ms. Nessuno stato hover (mobile). Nessun target inferiore a **44 × 44 pt**: nel design i pulsanti icona sono 36 px visivi, l'area tappabile va estesa a 44.

**Stati vuoti** — catalogo senza brani: messaggio breve + pulsante "Aggiungi il primo brano". Scaletta vuota: "Aggiungi brano" come unica azione. Ricerca senza risultati: testo su una riga, nessuna illustrazione.

**Sincronizzazione band** — le modifiche a brani e scalette di un catalogo band si propagano ai membri. Serve un indicatore di stato discreto ("salvato 12:04" nell'editor) e la gestione dei conflitti in scrittura contemporanea (l'ultima modifica vince, con avviso).

**Accessibilità** — il contrasto del testo canzone (`#1A1614` su `#FAF8F6`) è ≈ 15:1. Il testo deve rispettare Dynamic Type: il pattern accordi-sopra-parole va verificato a tutte le dimensioni, l'altezza fissa del box accordo deve scalare col font. Ogni token di testo con accordo va letto dallo screen reader come "accordo Em, Canta".

---

## State Management

**Globale / persistito**
- `catalogs: [Catalog]` — id, nome, tipo (personale/band), colore, membri, conteggi
- `songs: [Song]` — modello descritto sopra
- `setlists: [Setlist]` — id, catalogo, nome, data, note generali, elementi ordinati (brano o nota)
- `currentUser`, `bandMemberships`
- `favorites: Set<SongID>`

**Per schermata**
- Lista canzoni: `searchQuery`, `activeTab` (canzoni/scalette/preferite), `scrollAnchor`
- Viewer: `transposeOffset`, `capo`, `fontScale`, `autoScrollActive`, `autoScrollSpeed`, `optionsSheetOpen`
- Editor: `draft: Song`, `activeMode` (testo/accordi/struttura/dinamica), `selectedToken`, `isDirty`, `lastSavedAt`, `undoStack` / `redoStack`
- Scaletta: `isReordering`, `draggingItemID`

**Dati** — lettura dei cataloghi all'avvio, brano completo al primo accesso e poi in cache. I cataloghi band richiedono sincronizzazione in tempo reale o pull all'apertura. L'editor salva in bozza locale a ogni pausa di digitazione (debounce ~800 ms) e fa commit al tap su Salva.

---

## Assets

Nessun asset binario. Il design usa solo:
- **Google Fonts**: Sora, Hanken Grotesk, JetBrains Mono
- Icone: glifi tipografici segnaposto, **da sostituire** con il set di icone della piattaforma o del codebase (vedi tabella nei token)
- Nessuna immagine: le pastiglie catalogo sono lettere su fondo colorato, gli avatar sono iniziali su fondo colorato

Se il codebase ha già un design system, mappare i token qui elencati sui suoi equivalenti prima di introdurne di nuovi.

## Screenshots

`screenshots/` contiene un'immagine per schermata a 2x (804 × 1812 px), catturata dai prototipi HTML:

| File | Schermata |
|---|---|
| `01-home.png` | Home |
| `02-lista-canzoni.png` | Lista canzoni |
| `03-viewer.png` | Viewer canzone (con sheet opzioni aperto) |
| `04-editor.png` | Editor canzone |
| `05-scaletta.png` | Scaletta |

Le immagini includono il frame iPhone di presentazione e la didascalia sotto: **non fanno parte del design**, servono solo a mostrare il contesto del dispositivo. Fanno fede i valori numerici indicati in questo documento, non i pixel misurati sulle immagini.

## Files

- `ChordsNote Palco.dc.html` — le cinque schermate finali nella direzione "Palco" (questo è il riferimento da implementare)
- `ChordsNote.dc.html` — esplorazioni precedenti (direzioni 1a "Carta", 1b "Studio", 2a "Palco", 2b "Griglia", 2c "Shelf"), utili solo come contesto sulle alternative scartate
- `ios-frame.jsx`, `support.js` — scaffolding di prototipazione, **non** parte del design
