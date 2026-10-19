// 문서 검사: 용어집(GLOSSARY.md)의 "피할 말"이 스펙·ADR에 쓰인 곳을 찾아 실패로 알린다.
// `pnpm check:docs` 로 돌린다. 같은 글자라도 뜻이 다른 쓰임은 doc-terms/allowlist.json 에 짝으로 뺀다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AllowEntry, type Doc, findAvoidedWords } from "./doc-terms/check.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

function markdownIn(dir: string): Doc[] {
  return readdirSync(join(root, dir))
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const path = `${dir}/${name}`;
      return { path, text: read(path) };
    });
}

const hits = findAvoidedWords({
  glossary: read("GLOSSARY.md"),
  docs: [...markdownIn("docs/specs"), ...markdownIn("docs/adr")],
  allowlist: JSON.parse(read("scripts/doc-terms/allowlist.json")) as AllowEntry[],
});

for (const hit of hits) {
  const from = Math.max(0, hit.column - 1 - 15);
  const excerpt = hit.text.slice(from, hit.column - 1 + hit.word.length + 15);
  console.error(
    `${hit.path}:${hit.line}:${hit.column}  '${hit.word}' → '${hit.term}'  …${excerpt}…`,
  );
}

if (hits.length > 0) {
  console.error(
    `\n문서 검사 실패: ${hits.length}건. 용어집의 표제어로 고치거나, 뜻이 다른 쓰임이면 scripts/doc-terms/allowlist.json 에 (word, phrase, reason) 을 더한다.`,
  );
  process.exit(1);
}
console.log("문서 검사 통과: 스펙·ADR에 피할 말이 없다.");
