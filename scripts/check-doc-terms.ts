// 문서 검사: 용어집(GLOSSARY.md)의 "피할 말"이 스펙·ADR에 쓰인 곳과, 스펙·ADR에 쓴 HTML(<br> 만 허용)을
// 찾아 실패로 알린다. `pnpm check:docs` 로 돌린다. 같은 글자라도 뜻이 다른 쓰임은
// doc-terms/allowlist.json 에 짝으로 뺀다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AllowEntry, type Doc, findAvoidedWords, findHtml } from "./doc-terms/check.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// 하위 폴더까지 모두 훑는다. 경로는 운영체제와 상관없이 / 로 적는다.
function markdownIn(dir: string): Doc[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .map((name) => name.replaceAll("\\", "/"))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const path = `${dir}/${name}`;
      return { path, text: read(path) };
    });
}

const docs = [...markdownIn("docs/specs"), ...markdownIn("docs/adr")];
const hits = findAvoidedWords({
  glossary: read("GLOSSARY.md"),
  docs,
  allowlist: JSON.parse(read("scripts/doc-terms/allowlist.json")) as AllowEntry[],
});
const htmlHits = findHtml(docs);

const excerpt = (text: string, column: number, length: number) =>
  text.slice(Math.max(0, column - 1 - 15), column - 1 + length + 15);

for (const hit of hits) {
  const around = excerpt(hit.text, hit.column, hit.word.length);
  console.error(
    `${hit.path}:${hit.line}:${hit.column}  '${hit.word}' → '${hit.term}'  …${around}…`,
  );
}
for (const hit of htmlHits) {
  const around = excerpt(hit.text, hit.column, 1);
  console.error(
    `${hit.path}:${hit.line}:${hit.column}  HTML 은 쓰지 않는다 — 마크다운으로 쓴다(<br> 만 허용)  …${around}…`,
  );
}

const failures = hits.length + htmlHits.length;
if (failures > 0) {
  console.error(
    `\n문서 검사 실패: ${failures}건. 피할 말은 용어집의 표제어로 고치거나, 뜻이 다른 쓰임이면 scripts/doc-terms/allowlist.json 에 (word, phrase, reason) 을 더한다. HTML 은 마크다운으로 바꾼다.`,
  );
  process.exit(1);
}
console.log("문서 검사 통과: 스펙·ADR에 피할 말과 HTML 이 없다.");
