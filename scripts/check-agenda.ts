import assert from 'node:assert/strict';

import { bandAgenda, upcoming } from '../lib/agenda.ts';
import type { BandEvent, Setlist } from '../lib/types.ts';

/**
 * L'unico pezzo di logica della sezione band che vale la pena controllare da
 * solo: `node scripts/check-agenda.ts`.
 */

const event = (patch: Partial<BandEvent> & { id: string; at: string }): BandEvent => ({
  bandId: 'b1',
  kind: 'gig',
  title: 'Evento',
  createdBy: 'u1',
  createdAt: 0,
  ...patch,
});

const setlist = (patch: Partial<Setlist> & { id: string }): Setlist => ({
  catalogId: 'b1',
  name: 'Scaletta',
  items: [],
  createdAt: 0,
  updatedAt: 0,
  ...patch,
});

/* Ordine per data, non per ordine di arrivo. */
{
  const agenda = bandAgenda(
    [
      event({ id: 'e2', at: '2026-08-20T21:00:00' }),
      event({ id: 'e1', at: '2026-08-14T21:30:00' }),
    ],
    []
  );
  assert.deepEqual(agenda.map((entry) => entry.id), ['e1', 'e2']);
}

/* Una scaletta collegata a un evento non compare due volte. */
{
  const agenda = bandAgenda(
    [event({ id: 'e1', at: '2026-08-14T21:30:00', setlistId: 's1' })],
    [setlist({ id: 's1', date: '2026-08-14T21:30:00' })]
  );
  assert.equal(agenda.length, 1);
  assert.equal(agenda[0].id, 'e1');
  assert.equal(agenda[0].setlistId, 's1');
}

/* Una scaletta datata che nessun evento collega entra da sola. */
{
  const agenda = bandAgenda([], [setlist({ id: 's2', name: 'Estate', date: '2026-07-01T21:00:00' })]);
  assert.equal(agenda.length, 1);
  assert.equal(agenda[0].title, 'Estate');
  assert.equal(agenda[0].fromSetlist, true);
}

/* Una scaletta senza data non è una data. */
assert.deepEqual(bandAgenda([], [setlist({ id: 's3' })]), []);

/* Mezzanotte e fine mese: l'ordinamento è sulla stringa ISO, che li regge. */
{
  const agenda = bandAgenda(
    [
      event({ id: 'settembre', at: '2026-09-01T00:30:00' }),
      event({ id: 'agosto', at: '2026-08-31T23:45:00' }),
    ],
    []
  );
  assert.deepEqual(agenda.map((entry) => entry.id), ['agosto', 'settembre']);
}

/* "In arrivo" conta i giorni interi: il concerto di stasera lo è ancora a notte fonda. */
{
  const now = new Date('2026-08-14T23:50:00');
  const agenda = bandAgenda(
    [
      event({ id: 'stasera', at: '2026-08-14T21:30:00' }),
      event({ id: 'ieri', at: '2026-08-13T21:30:00' }),
      event({ id: 'domani', at: '2026-08-15T21:30:00' }),
    ],
    []
  );
  assert.deepEqual(upcoming(agenda, now).map((entry) => entry.id), ['stasera', 'domani']);
}

console.log('agenda: tutto a posto');
