/**
 * Cloud backend against a stand-in Supabase client: rows are normalised the
 * same way as the local backend, a unique-constraint error becomes the
 * double-dose guard, other errors become one friendly sentence, and a failed
 * first-time setup cleans up after itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Records every call and answers with the queued result for that table. */
const calls = [];
const results = {};
function query(table) {
  const q = {
    insert(rows) {
      calls.push([table, 'insert', rows]);
      return q;
    },
    update(rows) {
      calls.push([table, 'update', rows]);
      return q;
    },
    delete() {
      calls.push([table, 'delete']);
      return q;
    },
    select() {
      return q;
    },
    eq() {
      return q;
    },
    in(col, ids) {
      calls.push([table, 'in', ids]);
      return q;
    },
    gte() {
      return q;
    },
    order() {
      return q;
    },
    single() {
      return Promise.resolve(next(table));
    },
    then(resolve, reject) {
      return Promise.resolve(next(table)).then(resolve, reject);
    },
  };
  return q;
}
const next = (table) => (results[table]?.length ? results[table].shift() : { data: [], error: null });

vi.mock('../js/supabaseClient.js', () => ({ db: () => ({ from: query }) }));
const { CloudBackend } = await import('../js/storeCloud.js');
const { DuplicateDoseError } = await import('../js/storeRows.js');

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(results)) delete results[k];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
const cloud = new CloudBackend();

describe('reading', () => {
  it('normalises Postgres time strings and numbers', async () => {
    results.profiles = [{ data: [{ id: 'p1', name: 'Dadi', breakfast_time: '08:00:00' }], error: null }];
    expect((await cloud.listProfiles())[0].breakfast_time).toBe('08:00');

    results.medicines = [
      {
        data: [
          {
            id: 'm1',
            times: ['20:45:00', '08:15:00'],
            slots: ['dinner', 'breakfast'],
            days: ['1', '2'],
            dose_qty: '1.5',
            stock: '10',
          },
        ],
        error: null,
      },
    ];
    const [med] = await cloud.listMedicines('p1');
    expect(med).toMatchObject({
      times: ['08:15', '20:45'],
      slots: ['breakfast', 'dinner'],
      days: [1, 2],
      dose_qty: 1.5,
      stock: 10,
    });
  });

  it('skips the query when there are no medicines', async () => {
    expect(await cloud.listLogs([], '2026-01-01')).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('writing', () => {
  it('only sends known columns', async () => {
    results.medicines = [{ data: { id: 'm1', times: ['08:00'], days: [1] }, error: null }];
    await cloud.saveMedicine({ name: 'Telma', times: ['08:00'], days: [1], user_id: 'someone-else', is_admin: true });
    const [, , sent] = calls.find(([t, op]) => t === 'medicines' && op === 'insert');
    expect(sent).toEqual({ name: 'Telma', times: ['08:00'], days: [1] });
  });

  it('turns a duplicate log into DuplicateDoseError, and other errors into a friendly message', async () => {
    results.dose_logs = [{ data: null, error: { code: '23505', message: 'duplicate key' } }];
    await expect(cloud.addLog({ medicine_id: 'm1', scheduled_for: 'x', status: 'taken' })).rejects.toBeInstanceOf(
      DuplicateDoseError,
    );

    results.profiles = [{ data: null, error: { code: '42501', message: 'permission denied for table profiles' } }];
    await expect(cloud.deleteProfile('p1')).rejects.toThrow(
      'Could not save. Please check your internet connection and try again.',
    );
  });

  it('removes the half-made family if first-time setup fails', async () => {
    results.profiles = [{ data: null, error: null }];
    results.medicines = [{ data: null, error: { code: '23514', message: 'check violation' } }];
    await expect(
      cloud.importAll({ profiles: [{ id: 'p1', name: 'Dadi' }], medicines: [{ id: 'm1', name: 'X' }], logs: [] }),
    ).rejects.toThrow();
    expect(calls).toContainEqual(['profiles', 'in', ['p1']]);
  });

  it('inserts history in batches of 500', async () => {
    const logs = Array.from({ length: 1100 }, (_, i) => ({
      id: String(i),
      medicine_id: 'm1',
      scheduled_for: 'x',
      status: 'taken',
      logged_at: 'y',
    }));
    await cloud.importAll({ profiles: [{ id: 'p1', name: 'Dadi' }], medicines: [], logs });
    const batches = calls.filter(([t, op]) => t === 'dose_logs' && op === 'insert').map(([, , rows]) => rows.length);
    expect(batches).toEqual([500, 500, 100]);
  });
});
