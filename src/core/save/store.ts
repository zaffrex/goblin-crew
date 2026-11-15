import { BACKUP_KEY, SAVE_KEY, parseSave, validateSave, type SaveData } from './schema';

/** 계약: save/clear 실패 시 reject하며 기존 세이브는 유지된다. 원격 구현체도 같은 규칙을 따른다. */
export interface SaveStore {
  load(): Promise<SaveData | null>;
  save(d: SaveData): Promise<void>;
  clear(): Promise<void>;
}

/** localStorage와 같은 모양의 최소 인터페이스. Node 테스트에서 주입한다. */
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class MemoryStorage implements StorageLike {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

/** 쓰기를 시험해 보고 실패(SecurityError/Quota)하면 메모리 저장소로 대체한다. persistent=false면 UI가 안내를 띄운다. */
export function probeStorage(get: () => StorageLike | undefined): { storage: StorageLike; persistent: boolean } {
  try {
    const s = get(); // 쿠키 차단 시 프로퍼티 접근 자체가 SecurityError를 던진다
    if (!s) throw new Error('no storage');
    s.setItem('goblincrew.probe', '1');
    s.removeItem('goblincrew.probe');
    return { storage: s, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

export class LocalSaveStore implements SaveStore {
  constructor(private s: StorageLike) {}

  async load(): Promise<SaveData | null> {
    const text = this.s.getItem(SAVE_KEY);
    if (text === null) return null;
    const data = parseSave(text);
    if (data) return data;
    // 손상/상위 버전: 덮어쓰지 않고 백업에 보관한 뒤 새 세이브로 시작한다.
    try { this.s.setItem(BACKUP_KEY, text); } catch { /* 백업 실패는 무시 */ }
    return null;
  }

  async save(d: SaveData): Promise<void> {
    const v = validateSave(d);
    if (!v) throw new Error('invalid SaveData');
    this.s.setItem(SAVE_KEY, JSON.stringify(v));
  }

  async clear(): Promise<void> {
    this.s.removeItem(SAVE_KEY);
  }
}
