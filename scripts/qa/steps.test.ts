import { describe, expect, it } from 'vitest';
import { parseSteps } from './steps.ts';

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
    for (const bad of ['eval 1', 'click 1', 'click a b', 'click 1 2 3', 'wait', 'wait -1', 'goto http://x']) {
      expect(() => parseSteps(bad)).toThrow('모르는 동작');
    }
  });
});
