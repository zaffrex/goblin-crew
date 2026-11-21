import { describe, expect, it } from 'vitest';
import { assertPlayableUrl } from './url-guard.ts';

describe('assertPlayableUrl', () => {
  it.each([
    'https://zaffrex.github.io/goblin-crew/',
    'https://zaffrex.github.io/goblin-crew/?screen=park_fountain',
    'http://localhost:4173/',
  ])('allows %s', (u) => expect(() => assertPlayableUrl(u)).not.toThrow());
  it.each([
    'https://zaffrex.github.io/goblin-crew/assets/index-abc.js',
    'https://zaffrex.github.io/goblin-crew/../other/',
    'https://zaffrex.github.io/other/',
    'http://localhost:4173/src/main.ts',
    'https://evil.example/goblin-crew/',
    'javascript://localhost/?%0Adocument.title=1',
    'data://localhost/?x',
  ])('rejects %s', (u) => expect(() => assertPlayableUrl(u)).toThrow());
});
