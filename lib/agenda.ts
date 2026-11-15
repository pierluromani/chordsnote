import type { BandEvent, BandEventKind, Setlist } from './types';

/**
 * Le date di una band viste come una lista sola.
 *
 * Una band ha due modi di avere una data: un evento — prova, concerto, altro,
 * con l'ora e il luogo — e una scaletta a cui qualcuno ha messo una data. Sono
 * la stessa cosa vista da due parti, e l'agenda le mette in fila insieme.
 *
 * Il file non importa niente a runtime — solo tipi, che spariscono in
 * compilazione — apposta: così `scripts/check-agenda.ts` lo esegue con `node`
 * senza tirarsi dietro Firebase.
 */
export type AgendaEntry = {
  /** L'id dell'evento, o quello della scaletta se la voce nasce da lì. */
  id: string;
  kind: BandEventKind;
  title: string;
  /** ISO con l'ora. È anche la chiave di ordinamento. */
  at: string;
  place?: string;
  note?: string;
  setlistId?: string;
  /** Vero quando la voce è solo una scaletta datata: non si modifica da qui. */
  fromSetlist?: boolean;
};

/**
 * Eventi e scalette datate in ordine di data. Una scaletta collegata a un
 * evento compare una volta sola, dentro l'evento: chi ha scritto "il 14 si
 * suona questa" non vuole vedersela due volte.
 */
export function bandAgenda(events: BandEvent[], setlists: Setlist[]): AgendaEntry[] {
  const linked = new Set(events.map((event) => event.setlistId).filter(Boolean));

  const entries: AgendaEntry[] = events.map((event) => ({
    id: event.id,
    kind: event.kind,
    title: event.title,
    at: event.at,
    place: event.place,
    note: event.note,
    setlistId: event.setlistId,
  }));

  for (const setlist of setlists) {
    if (!setlist.date || linked.has(setlist.id)) continue;
    entries.push({
      id: setlist.id,
      kind: 'gig',
      title: setlist.name,
      at: setlist.date,
      setlistId: setlist.id,
      fromSetlist: true,
    });
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

/** Da adesso in avanti, contando per giorni interi: un concerto alle 21 è ancora "in arrivo" alle 22. */
export function upcoming(entries: AgendaEntry[], now: Date = new Date()): AgendaEntry[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return entries.filter((entry) => {
    const time = new Date(entry.at).getTime();
    return !Number.isNaN(time) && time >= today;
  });
}
