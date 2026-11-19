import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// #256: 게임 안 글은 전부 일본어(진마씨 B안, docs/decisions/2026-11-17-japanese-only.md).
// 플레이어가 보는 글에 한국어가 다시 들어오지 않게 막는다.
// - index.html: 주석 밖에 한글이 없어야 한다.
// - content/text/ja.json: 값에 한글이 없어야 한다.
// - src/ (테스트 제외) 문자열: 한글은 개발자 전용 메시지에만 허용한다. 주석은 보지 않는다. 개발자 메시지는 아래 노드 안의 글이다.
//   1. `new …Error(...)` 인자, `console.*(...)` 인자
//   2. 같은 파일 안의 "몸통이 throw new …Error 하나뿐인 함수"(예: const fail = (why) => { throw new Error(why) }) 호출 인자
//   3. 객체 리터럴의 `error` 속성 값(`{ ok: false, error: '…' }`, flow.ts 결과 모양. #274)
//   4. `.err(...)`·`.warn(...)` 메서드 호출 인자(validate.ts `Checker`가 모으는 검사 결과. #274)
//   파일 통째로 빼는 것(DEV_ONLY)은 결과 문자열 전체가 개발자용인 모듈만 둔다. 새 파일은 기본으로 검사된다.

/**
 * 결과가 콘솔·CI로만 가는 모듈. 파일 통째로 뺀다. 여기 글이 화면에 나오게 바뀌면 목록에서 빼야 한다.
 * check.ts(BFS 리포트)는 글을 배열에 모아 돌려주는 곳이 10군데가 넘고 모양이 제각각이라 노드 단위로 넘기지 않는다.
 * 런타임(main.ts)에서 부르지 않고 tests·CI만 쓴다. flow.ts·validate.ts는 #274에서 노드 단위 검사로 옮겼다.
 */
const DEV_ONLY = new Set(["src/core/puzzle/check.ts"]);

/** 메서드 호출 인자가 개발자 메시지인 이름(4번). `console.warn`은 1번이 먼저 잡는다. */
const DEV_METHODS = new Set(["err", "warn"]);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.ts$/.test(e.name) &&
      !/\.test\.ts$/.test(e.name) &&
      !e.name.endsWith(".d.ts")
      ? [p]
      : [];
  });
}

function isNewError(n: ts.Node | undefined): boolean {
  return (
    !!n &&
    ts.isNewExpression(n) &&
    ts.isIdentifier(n.expression) &&
    /Error$/.test(n.expression.text)
  );
}

/** 몸통이 `throw new …Error(...)` 하나뿐인 함수인가. */
function onlyThrowsError(fn: ts.Node | undefined): boolean {
  if (
    !fn ||
    !(
      ts.isArrowFunction(fn) ||
      ts.isFunctionExpression(fn) ||
      ts.isFunctionDeclaration(fn)
    )
  )
    return false;
  const body = fn.body;
  if (!body || !ts.isBlock(body) || body.statements.length !== 1) return false;
  const st = body.statements[0];
  return !!st && ts.isThrowStatement(st) && isNewError(st.expression);
}

/** 이 파일에서 throw만 하는 도우미 함수 이름들(`const fail = (...) => { throw new Error(...) }`, `function fail() {...}`). */
function throwHelpers(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      onlyThrowsError(node.initializer)
    )
      names.add(node.name.text);
    if (ts.isFunctionDeclaration(node) && node.name && onlyThrowsError(node))
      names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

/** `{ error: … }`의 값인가(3번). 키 이름만 본다. 같은 객체의 다른 키(`text: '…'`)는 그대로 검사한다. */
function isErrorProperty(n: ts.Node, child: ts.Node): boolean {
  return (
    ts.isPropertyAssignment(n) &&
    n.initializer === child &&
    (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
    n.name.text === "error"
  );
}

/** 이 노드가 개발자 전용 메시지 안에 있나(맨 위 주석 1~4번). */
function isDevMessage(node: ts.Node, helpers: Set<string>): boolean {
  for (
    let child = node, n: ts.Node | undefined = node.parent;
    n;
    child = n, n = n.parent
  ) {
    if (isNewError(n)) return true;
    if (isErrorProperty(n, child)) return true;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "console"
      )
        return true;
      if (ts.isIdentifier(callee) && helpers.has(callee.text)) return true;
      // 4번: 인자만 넘긴다. 받는 쪽(`a.b.err`의 `a.b`)에 든 글은 인자가 아니라 계속 검사한다.
      if (
        ts.isPropertyAccessExpression(callee) &&
        DEV_METHODS.has(callee.name.text) &&
        n.arguments.some((a) => a === child)
      )
        return true;
    }
    if (ts.isFunctionLike(n) || ts.isSourceFile(n)) break;
  }
  return false;
}

/** 한글이 든 문자열 중 개발자 메시지가 아닌 것. */
function playerKorean(
  file: string,
  text = readFileSync(file, "utf8"),
): string[] {
  if (!HANGUL.test(text)) return [];
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const helpers = throwHelpers(sf);
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node);
    if (
      isText &&
      HANGUL.test(node.text) &&
      !isDevMessage(
        ts.isTemplateLiteralToken(node) ? node.parent : node,
        helpers,
      )
    ) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      hits.push(
        `${relative(ROOT, file)}:${line + 1} ${JSON.stringify(node.text)}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe("플레이어가 보는 글에 한국어 없음 (#256)", () => {
  it("index.html 주석 밖에 한글이 없고 lang은 ja", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const visible = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(visible.split("\n").filter((l) => HANGUL.test(l))).toEqual([]);
    expect(html).toMatch(/<html lang="ja">/);
  });

  it("content/text에는 ja.json 하나뿐이고 값에 한글이 없다", () => {
    expect(readdirSync(join(ROOT, "content/text"))).toEqual(["ja.json"]);
    const texts = JSON.parse(
      readFileSync(join(ROOT, "content/text/ja.json"), "utf8"),
    ) as Record<string, string>;
    expect(Object.entries(texts).filter(([, v]) => HANGUL.test(v))).toEqual([]);
  });

  it("src/ 문자열의 한글은 개발자 메시지(Error·console, 데이터 검사기)에만 있다", () => {
    const files = sourceFiles(join(ROOT, "src")).filter(
      (f) => !DEV_ONLY.has(relative(ROOT, f).split("\\").join("/")),
    );
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap((f) => playerKorean(f))).toEqual([]);
  });

  it("검사기 자체: 플레이어용 한글은 잡고, 주석·개발자 메시지는 넘긴다", () => {
    const probe = (code: string) =>
      playerKorean(join(ROOT, "probe.ts"), code).map((x) =>
        x.replace(/^\S+ /, ""),
      );
    expect(probe("el.textContent = '안녕';")).toEqual(['"안녕"']);
    expect(probe("el.textContent = `${n}개 남음`;")).toEqual(['"개 남음"']);
    expect(
      probe(
        "// 주석 '안녕'\nthrow new Error('없어요');\nconsole.warn(`경고 ${x}`);",
      ),
    ).toEqual([]);
    // throw만 하는 같은 파일 도우미의 인자는 개발자 메시지다. 다른 일도 하는 함수 인자는 잡는다.
    expect(
      probe(
        "const fail = (why: string): never => { throw new Error(`오류: ${why}`); };\nfail('객체가 아님');\nfunction say(s: string) { el.textContent = s; }\nsay('안녕');",
      ),
    ).toEqual(['"안녕"']);
    // #274: `error` 속성 값은 넘기고, 같은 객체의 다른 속성·키 이름이 비슷한 속성은 잡는다.
    expect(
      probe(
        "return { ok: false, error: `order[${i}]: 중복 id ${id}` };\nreturn { ok: true, text: '안녕', errorText: '실패' };",
      ),
    ).toEqual(['"안녕"', '"실패"']);
    // 키가 error라도 값 안의 함수가 화면에 쓰는 글은 잡는다(속성 값 자체만 넘긴다).
    expect(
      probe(
        "const r = { error: (() => { el.textContent = '안녕'; return 'x'; })() };",
      ),
    ).toEqual(['"안녕"']);
    // #274: `.err`·`.warn` 인자는 넘긴다. 다른 메서드(`.say`)와 받는 쪽 식 안의 글은 잡는다.
    expect(
      probe(
        "c.err(path, 'schema', '객체여야 한다');\nthis.warn(p, 'x', `모르는 필드: ${k}`);\nhud.say('안녕');\npick('대사').err('x');",
      ),
    ).toEqual(['"안녕"', '"대사"']);
  });

  it("#274: flow.ts·validate.ts는 통째로 빼지 않고, 화면용 한글을 넣으면 잡힌다", () => {
    expect(DEV_ONLY.has("src/core/flow.ts")).toBe(false);
    expect(DEV_ONLY.has("src/core/puzzle/validate.ts")).toBe(false);
    const file = join(ROOT, "src/core/flow.ts");
    const text = readFileSync(file, "utf8");
    expect(playerKorean(file, text)).toEqual([]);
    // 끝 카드 글처럼 화면에 나갈 글을 한 줄 넣으면 실패해야 한다(설계 ui-interaction.md 11절).
    const hits = playerKorean(
      file,
      `${text}\nexport const END_CARD = '1장 끝';\n`,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/^src\/core\/flow\.ts:\d+ "1장 끝"$/);
  });
});
