import { describe, expect, it } from 'vitest';
import fixture from '../../../tests/fixtures/saves/v1.json';
import { parseSave } from './schema';
import { LocalSaveStore, MemoryStorage, probeStorage } from './store';
import { BACKUP_KEY, SAVE_KEY } from './schema';

const v1 = JSON.stringify(fixture);

describe('parseSave', () => {
  it('loads the v1 fixture', () => {
    expect(parseSave(v1)?.checkpoint.screenId).toBe('s02');
  });
  it('rejects bad json, unknown versions, bad ranges, oversize', () => {
    expect(parseSave('{')).toBeNull();
    expect(parseSave(v1.replace('"version":1', '"version":99'))).toBeNull();
    expect(parseSave(v1.replace('"gauge":80', '"gauge":-1'))).toBeNull();
    expect(parseSave(v1.replace('"gauge":80', '"gauge":1e9'))).toBeNull();
    expect(parseSave(' '.repeat(60_000) + v1)).toBeNull();
  });
  it('rejects __proto__ keys and strips unknown keys', () => {
    expect(parseSave(v1.replace('{"version":1', '{"__proto__":{"x":1},"version":1'))).toBeNull();
    const extra = parseSave(v1.replace('{"version":1', '{"evil":1,"version":1'));
    expect(extra && 'evil' in extra).toBe(false);
  });
});

describe('LocalSaveStore', () => {
  it('round-trips and clears', async () => {
    const st = new LocalSaveStore(new MemoryStorage());
    const d = parseSave(v1)!;
    await st.save(d);
    expect(await st.load()).toEqual(d);
    await st.clear();
    expect(await st.load()).toBeNull();
  });
  it('rejects invalid save and keeps the existing one', async () => {
    const st = new LocalSaveStore(new MemoryStorage());
    const d = parseSave(v1)!;
    await st.save(d);
    await expect(st.save({ ...d, checkpoint: { ...d.checkpoint, gauge: 999 } })).rejects.toThrow();
    expect(await st.load()).toEqual(d);
  });
  it('backs up corrupt data instead of overwriting', async () => {
    const m = new MemoryStorage();
    m.setItem(SAVE_KEY, 'garbage');
    expect(await new LocalSaveStore(m).load()).toBeNull();
    expect(m.getItem(BACKUP_KEY)).toBe('garbage');
  });
  it('probeStorage falls back to memory when storage throws', () => {
    const bad = { getItem: () => null, removeItem() {}, setItem() { throw new Error('Quota'); } };
    expect(probeStorage(() => bad).persistent).toBe(false);
    expect(probeStorage(() => { throw new Error('SecurityError'); }).persistent).toBe(false);
    expect(probeStorage(() => undefined).persistent).toBe(false);
    expect(probeStorage(() => new MemoryStorage()).persistent).toBe(true);
  });
});
