// 회색 배치 검사 CLI(#768). 화면마다 서는 자리 표와 겹침을 찍고, error가 하나라도 있으면 종료 코드 1.
//   node --import ./scripts/playtest/register.mjs scripts/layout/layout-check.ts              # 모든 화면
//   node --import ./scripts/playtest/register.mjs scripts/layout/layout-check.ts laundromat   # 하나만
//   ... --stands   # 서는 자리 표도 찍는다(기본은 겹침만)
import console from 'node:console';
import process from 'node:process';
import { layoutReport } from './check.ts';
import { loadScene, screenIds } from './load.ts';

const args = process.argv.slice(2);
const showStands = args.includes('--stands');
const ids = args.filter((a) => !a.startsWith('--'));
let errors = 0;
for (const id of ids.length ? ids : screenIds()) {
  const r = layoutReport(loadScene(id));
  const e = r.problems.filter((p) => p.level === 'error').length;
  errors += e;
  console.log(`\n== ${id}: 서는 자리 ${r.stands.length}개, error ${e}, warning ${r.problems.length - e}`);
  if (showStands) {
    // 동사만 다르고 자리가 같은 줄은 합친다.
    const rows = new Map<string, string[]>();
    for (const s of r.stands) {
      const flags = Object.entries(s.flags).map(([k, v]) => `${k}=${v}`).join(',');
      const key = `${s.char.padEnd(6)} → ${s.target.padEnd(14)} ${s.side.padEnd(5)} ${String(s.x).padStart(3)},${s.y}${flags ? ` [${flags}]` : ''}`;
      rows.set(key, [...(rows.get(key) ?? []), s.verb]);
    }
    for (const [k, verbs] of rows) console.log(`  ${k}  (${verbs.join('/')})`);
  }
  for (const p of r.problems) console.log(`  ${p.level === 'error' ? 'ERROR' : 'warn '} ${p.code}: ${p.message}`);
}
process.exit(errors > 0 ? 1 : 0);
