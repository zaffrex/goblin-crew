import { describe, expect, it } from 'vitest';
import { MAX_SHOTS, midShotPath, parseSteps } from './steps.ts';

describe('parseSteps (#603)', () => {
  it('reads a file body and an inline --steps string the same way', () => {
    const file = 'wait 2000\n# memo\nclick 640 360\n';
    const inline = 'wait 2000; # memo; click 640 360';
    const want = [{ cmd: 'wait', ms: 2000 }, { cmd: 'click', x: 640, y: 360 }];
    expect(parseSteps(file)).toEqual(want);
    expect(parseSteps(inline)).toEqual(want);
  });

  it('caps wait at 5000ms and allows an empty list', () => {
    expect(parseSteps('wait 99999')).toEqual([{ cmd: 'wait', ms: 5000 }]);
    expect(parseSteps('')).toEqual([]);
    expect(parseSteps(' ; ;\n')).toEqual([]);
  });

  it('rejects anything that is not a plain click or wait', () => {
    for (const bad of ['eval 1', 'click 1', 'click a b', 'click 1 2 3', 'wait', 'wait -1', 'goto http://x', 'shot', 'shot a b']) {
      expect(() => parseSteps(bad)).toThrow('모르는 동작');
    }
  });

  it('reads shot <name> mid-run steps (#643)', () => {
    expect(parseSteps('click 640 360; wait 1500; shot intro; wait 4000; shot walk_2')).toEqual([
      { cmd: 'click', x: 640, y: 360 },
      { cmd: 'wait', ms: 1500 },
      { cmd: 'shot', name: 'intro' },
      { cmd: 'wait', ms: 4000 },
      { cmd: 'shot', name: 'walk_2' },
    ]);
  });

  it('rejects shot names that could escape the shot folder or are not file-safe', () => {
    for (const bad of ['../x', 'a/b', 'a.png', '..', 'あ', 'a'.repeat(25), 'a$b']) {
      expect(() => parseSteps(`shot ${bad}`)).toThrow('모르는 동작');
    }
  });

  it('caps shots per run and rejects duplicate names', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `shot s${i}`).join(';');
    expect(parseSteps(many(MAX_SHOTS))).toHaveLength(MAX_SHOTS);
    expect(() => parseSteps(many(MAX_SHOTS + 1))).toThrow(`${MAX_SHOTS}장까지`);
    expect(() => parseSteps('shot a; wait 100; shot a')).toThrow('겹쳐요: a');
  });

  it('puts a mid-run shot next to the final shot file', () => {
    expect(midShotPath('qa-work/d5.png', 'peck')).toBe('qa-work/d5-peck.png');
    expect(midShotPath('qa-work/D5.PNG', 'peck')).toBe('qa-work/D5-peck.png');
    expect(midShotPath('qa-work/d5', 'peck')).toBe('qa-work/d5-peck.png');
  });
});
