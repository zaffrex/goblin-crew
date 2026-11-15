// 세이브 스키마 v1과 검증 (ADR-0006). 입력은 항상 신뢰할 수 없는 데이터로 취급한다.

export const SAVE_KEY = 'goblincrew.save.v1';
export const BACKUP_KEY = 'goblincrew.save.backup';
export const CURRENT_VERSION = 1;
export const MAX_SAVE_BYTES = 50 * 1024;

export interface SaveData {
  version: 1;
  contentVersion: string;
  updatedAt: string;
  progress: { solvedScreens: string[] };
  checkpoint: { screenId: string; gauge: number; activeCharacter: string; carriedItems: string[] };
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_LIST = 256;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function idList(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > MAX_LIST) return null;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string' || !ID_RE.test(x)) return null;
    out.push(x);
  }
  return out;
}

/** 검증 후 새 객체를 만들어 돌려준다(알 수 없는 키는 버림). 실패하면 null. */
export function validateSave(raw: unknown): SaveData | null {
  if (!isRecord(raw) || raw['version'] !== 1) return null;
  for (const k of Object.keys(raw)) if (FORBIDDEN_KEYS.has(k)) return null;
  const { contentVersion, updatedAt, progress, checkpoint } = raw;
  if (typeof contentVersion !== 'string' || !ID_RE.test(contentVersion)) return null;
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt))) return null;
  if (!isRecord(progress) || !isRecord(checkpoint)) return null;
  const solved = idList(progress['solvedScreens']);
  const items = idList(checkpoint['carriedItems']);
  const { screenId, gauge, activeCharacter } = checkpoint;
  if (!solved || !items) return null;
  if (typeof screenId !== 'string' || !ID_RE.test(screenId)) return null;
  if (typeof activeCharacter !== 'string' || !ID_RE.test(activeCharacter)) return null;
  if (typeof gauge !== 'number' || !Number.isFinite(gauge) || gauge < 0 || gauge > 100) return null;
  return {
    version: 1,
    contentVersion,
    updatedAt,
    progress: { solvedScreens: solved },
    checkpoint: { screenId, gauge, activeCharacter, carriedItems: items },
  };
}

/** 문자열(파일/저장소 내용)을 파싱·마이그레이션·검증한다. 크기 상한 초과나 파싱 실패는 null. */
export function parseSave(text: string): SaveData | null {
  if (text.length > MAX_SAVE_BYTES) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return validateSave(migrate(raw));
}

// 버전별 마이그레이션 체인. v2가 생기면 [1]: (d) => ({...d, version: 2, ...}) 를 추가한다.
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let cur = raw;
  while (typeof cur['version'] === 'number' && cur['version'] < CURRENT_VERSION) {
    const fn = MIGRATIONS[cur['version']];
    if (!fn) return null;
    cur = fn(cur);
  }
  return cur;
}
