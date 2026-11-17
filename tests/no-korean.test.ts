import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// #256: 게임 안 글은 전부 일본어(사장님 B안, docs/decisions/2026-11-17-japanese-only.md).
// 플레이어가 보는 글에 한국어가 다시 들어오지 않게 막는다.
// - index.html: 주석 밖에 한글이 없어야 한다.
// - content/text/ja.json: 값에 한글이 없어야 한다.
// - src/ (테스트 제외) 문자열: 한글은 개발자 전용 메시지(throw하는 Error, console.*)에만 허용한다. 주석은 보지 않는다.
//   같은 파일 안의 "몸통이 throw new …Error 하나뿐인 함수"(예: const fail = (why) => { throw new Error(why) }) 호출 인자도 개발자 메시지로 본다.
//   데이터 검사기(아래 DEV_ONLY)는 결과 문자열 전체가 개발자용(콘솔·CI)이라 통째로 뺀다. 새 파일은 기본으로 검사된다.

/** 결과가 콘솔·CI로만 가는 데이터 검사 모듈. 여기 글이 화면에 나오게 바뀌면 목록에서 빼야 한다. */
const DEV_ONLY = new Set([
  "src/core/flow.ts",
  "src/core/puzzle/check.ts",
  "src/core/puzzle/validate.ts",
]);

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

/** 이 노드가 개발자 전용 메시지 안에 있나: `new Error(...)` 등의 인자, `console.*(...)` 인자, 같은 파일 throw 도우미 인자. */
function isDevMessage(node: ts.Node, helpers: Set<string>): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (isNewError(n)) return true;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "console"
      )
        return true;
      if (ts.isIdentifier(callee) && helpers.has(callee.text)) return true;
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
  });
});
