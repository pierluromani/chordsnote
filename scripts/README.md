# Verifiche band e inviti

Tre script che provano il modello dei permessi contro Firestore **vero**, non
contro un emulatore: creano account di prova (`@chordsnote.test`), band e brani
sul progetto `chordsnote`. Non vanno lanciati alla leggera.

Si eseguono dalla radice del repo, dove sta `node_modules`.

| Script | Cosa prova |
| --- | --- |
| `check-band-rules.mjs` | Il percorso normale: fondatore che crea e invita, invitato che accetta, editor che scrive, declassamento, eliminazione della band. |
| `check-band-rules-attack.mjs` | 18 tentativi che devono fallire: entrare senza invito, entrare promuovendosi, prendersi la band, portarsi dietro qualcun altro, scrivere da viewer, riusare un invito già consumato. |
| `check-invites-ui.mjs` | L'app intera, due browser, due account: invito, accettazione, brano che passa da uno all'altro in entrambe le direzioni, declassamento che toglie gli strumenti di scrittura. |

Il terzo vuole il build servito in locale:

```sh
npx expo export -p web
python3 -m http.server 8099 --directory dist &
node scripts/check-invites-ui.mjs
```

Le regole si mandano su con `npx firebase deploy --only firestore:rules`, ed è
il deploy stesso a compilarle: un errore di sintassi si vede lì.
