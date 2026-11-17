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
//   데이터 검사기(아래 DEV_ONLY)는 결과 문자열 전체가 개발자용(콘솔·CI)이라 통째로 뺀다. 새 파일은 기본으로 검사된다.

/** 결과가 콘솔·CI로만 가는 데이터 검사 모듈. 여기 글이 화면에 나오게 바뀌면 목록에서 빼야 한다. */
const DEV_ONLY = new Set([
  "src/core/flow.ts",
  "src/core/puzzle/check.ts",
  "src/core/puzzle/validate.ts",
  "src/core/sceneArt.ts",
  "src/core/sprite.ts",
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

/** 이 노드가 개발자 전용 메시지 안에 있나: `new Error(...)` 등의 인자이거나 `console.*(...)` 인자. */
function isDevMessage(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      /Error$/.test(n.expression.text)
    )
      return true;
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "console"
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
      !isDevMessage(ts.isTemplateLiteralToken(node) ? node.parent : node)
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
  });
});
