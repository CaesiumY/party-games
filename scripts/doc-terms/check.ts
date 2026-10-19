import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

export type Doc = { path: string; text: string };

export type AllowEntry = { word: string; phrase: string; reason: string };

export type Hit = {
  path: string;
  line: number;
  column: number;
  word: string;
  term: string;
  text: string;
};

type Avoided = { word: string; term: string };

const HEADWORD = /^\*\*(.+?) \(.+\)\*\*:/;
const AVOID = /^_Avoid_:\s*(.*)$/;

function readGlossary(glossary: string): Avoided[] {
  const avoided: Avoided[] = [];
  const headwords = new Set<string>();
  let term: string | null = null;
  for (const line of glossary.split(/\r?\n/)) {
    const head = HEADWORD.exec(line);
    if (head?.[1]) {
      term = head[1];
      headwords.add(term);
    }
    const avoid = AVOID.exec(line);
    if (avoid?.[1] !== undefined && term !== null) {
      // "칸(카테고리를 뜻함)" 처럼 괄호 안은 풀이라 뺀다.
      for (const word of avoid[1].replace(/\([^)]*\)/g, "").split(",")) {
        avoided.push({ word: word.trim(), term });
      }
    }
  }
  // 피할 말이 다른 용어의 표제어이면(예: '기록') 그 말은 제 뜻으로 쓰이므로 검사하지 않는다.
  return avoided.filter(({ word }) => !headwords.has(word));
}

// 어절은 띄어쓰기로 나눈 덩어리다. 그 안의 문장부호·따옴표·괄호·마크다운 기호(\p{P}\p{S})는
// 맞춰 볼 때 말의 경계로 본다.
type Eojeol = { raw: string; start: number };

function eojeols(line: string): Eojeol[] {
  return [...line.matchAll(/\S+/g)].map((m) => ({ raw: m[0], start: m.index }));
}

// 피할 말이 어절 i 안에서 시작하는 모든 자리(줄 안의 위치)를 돌려준다. 한 어절에 허용된
// 쓰임(「킵」)과 아닌 쓰임(킵)이 함께 있을 수 있어서, 첫 자리만 보고 멈추지 않는다.
// 여러 어절로 된 말은 그만큼의 어절을 이어 붙여 본다. 두 글자 이상은 그 말로 시작하면(조사가
// 붙어도) 걸린다.
function matchesAt(tokens: Eojeol[], i: number, word: string): number[] {
  const first = tokens[i];
  if (first === undefined) return [];
  if (word.length === 1) return matchOneLetter(first, word);
  const count = word.split(" ").length;
  if (i + count > tokens.length) return [];
  const joined = tokens
    .slice(i, i + count)
    .map((t) => t.raw)
    .join(" ");
  // 어절 첫머리와, 첫 어절 안에서 문장부호 바로 뒤(「방법」·「족보」 의 '족보')에서 시작해 본다.
  return [...first.raw.matchAll(/(?:^|[\p{P}\p{S}])(?=[^\p{P}\p{S}])/gu)]
    .map((m) => m.index + m[0].length)
    .filter((from) => joined.startsWith(word, from))
    .map((from) => first.start + from);
}

// 한 글자는 그 말만으로 된 어절일 때만 걸린다('통과'는 '통'이 아니다). 낫표·따옴표·괄호도
// 어절의 경계로 본다(「킵」이다 의 '킵' 은 그 말만으로 된 말이다).
function matchOneLetter(token: Eojeol, word: string): number[] {
  return [...token.raw.matchAll(/[^\p{P}\p{S}]+/gu)]
    .filter((m) => m[0] === word)
    .map((m) => token.start + m.index);
}

// 그 줄에서 허용 목록의 구절이 나온 자리 가운데 하나가 걸린 말을 덮으면 허용한다.
// 위치로 보므로 '물리 시뮬레이션' 은 '물리 시뮬레이션이' 도 덮고, 같은 줄의 다른 '시뮬레이션' 은 덮지 않는다.
// 구절은 어절 첫머리(줄 처음, 띄어쓰기나 문장부호 뒤)에서 시작해야 한다. '비물리 시뮬레이션' 은 덮지 않는다.
// 뒤쪽은 막지 않아서 조사가 붙어도 된다.
function allowed(allowlist: AllowEntry[], line: string, word: string, at: number): boolean {
  return allowlist.some(
    ({ word: allowedWord, phrase }) =>
      allowedWord === word &&
      positionsOf(line, phrase).some(
        (from) =>
          startsEojeol(line, from, phrase) &&
          from <= at &&
          at + word.length <= from + phrase.length,
      ),
  );
}

const BOUNDARY = /[\s\p{P}\p{S}]/u;

function startsEojeol(line: string, from: number, phrase: string): boolean {
  return from === 0 || BOUNDARY.test(line[from - 1] ?? "") || BOUNDARY.test(phrase[0] ?? "");
}

function positionsOf(line: string, phrase: string): number[] {
  const positions: number[] = [];
  for (let from = line.indexOf(phrase); from !== -1; from = line.indexOf(phrase, from + 1)) {
    positions.push(from);
  }
  return positions;
}

// 문서는 마크다운 해석기(mdast)로 읽는다. 맞춰 보는 덩어리는 문단·제목·표의 칸 하나씩이고
// (목록·인용 안의 문단도 문단이다), HTML 블록은 보이는 글자만 본다. 코드 블록·링크 정의·맨 앞의
// YAML 머리말은 보지 않는다. 문단 안의 인라인 HTML 태그는 건너뛰되 <br> 은 띄어쓰기로 본다.
// 링크는 글자만 보고 주소는 보지 않는다. 인라인 코드의 글자는 본다(문장 속 이름도 용어를 지켜야 해서).
type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

const PASSAGE = new Set(["paragraph", "heading", "tableCell"]);
const SKIPPED = new Set(["code", "html", "definition", "image", "imageReference"]);

// 파일 맨 앞의 YAML 머리말(--- 로 열고 --- 나 ... 로 닫는 줄들)을 같은 길이의 공백으로 지운다.
// 줄바꿈은 남기므로, 뒤 본문의 원문 위치(줄·칸)가 그대로다. 해석기에는 빈 줄로 보인다.
function blankFrontmatter(source: string): string {
  const open = /^---[ \t]*\r?\n/.exec(source);
  if (open === null) return source;
  const close = /^(?:---|\.\.\.)[ \t]*$/m.exec(source.slice(open[0].length));
  if (close === null) return source;
  const end = open[0].length + close.index + close[0].length;
  return source.slice(0, end).replace(/[^\r\n]/g, " ") + source.slice(end);
}

// 덩어리의 글과, 그 글의 각 글자가 원문의 몇 번째 글자였는지.
type Passage = { text: string; origin: number[] };

function parse(source: string): MdNode {
  return fromMarkdown(source, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MdNode;
}

function passages(original: string): Passage[] {
  const source = blankFrontmatter(original);
  const result: Passage[] = [];
  const walk = (node: MdNode) => {
    if (node.type === "html" && node.position !== undefined) {
      result.push(
        ...htmlPassages(source, node.position.start.offset ?? 0, node.position.end.offset),
      );
      return;
    }
    if (SKIPPED.has(node.type)) return;
    if (PASSAGE.has(node.type)) {
      const passage: Passage = { text: "", origin: [] };
      for (const child of node.children ?? []) addInline(child, passage, source);
      result.push(passage);
      return;
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(parse(source));
  return result;
}

// HTML 블록에서 화면에 보이는 글자만 뽑는다. 태그와 속성, 주석, <script>·<style> 의 내용은 뺀다.
// 블록 태그(<p>, <div>, <li> 같은 것)가 나오면 덩어리를 끊어, 다른 블록의 글끼리 잇지 않는다.
// <br> 은 띄어쓰기로, 그 밖의 태그(<span>, <b> 같은 것)는 없는 것으로 본다.
const HTML_MARKUP =
  /<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][\w-]*)[^>]*>/gi;
const HTML_BLOCK_TAGS = new Set(
  "address article aside blockquote dd details div dl dt figcaption figure footer h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td tfoot th thead tr ul".split(
    " ",
  ),
);

function htmlPassages(source: string, start: number, end = source.length): Passage[] {
  const result: Passage[] = [];
  let passage: Passage = { text: "", origin: [] };
  const addText = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      const char = source[k] ?? "";
      passage.text += /\s/.test(char) ? " " : char;
      passage.origin.push(k);
    }
  };
  let cursor = start;
  for (const m of source.slice(start, end).matchAll(HTML_MARKUP)) {
    const at = start + m.index;
    addText(cursor, at);
    cursor = at + m[0].length;
    const tag = m[2]?.toLowerCase();
    if (tag !== undefined && HTML_BLOCK_TAGS.has(tag)) {
      result.push(passage);
      passage = { text: "", origin: [] };
    } else if (tag === "br" || m[1] !== undefined || tag === undefined) {
      passage.text += " ";
      passage.origin.push(at);
    }
  }
  addText(cursor, end);
  result.push(passage);
  return result;
}

// 줄을 바꾸는 인라인 HTML(<br>, <br/>, <br />). 글자 사이를 띄어 쓴 것으로 본다.
const HTML_BREAK = /^<br\s*\/?>$/i;

function addInline(node: MdNode, passage: Passage, source: string): void {
  const start = node.position?.start.offset ?? 0;
  const htmlBreak = node.type === "html" && HTML_BREAK.test(node.value ?? "");
  if (!htmlBreak && SKIPPED.has(node.type)) return;
  if (node.type === "break" || htmlBreak) {
    passage.text += " ";
    passage.origin.push(start);
    return;
  }
  if (node.value !== undefined) {
    addValue(node.value, start, node.position?.end.offset ?? source.length, passage, source);
    return;
  }
  for (const child of node.children ?? []) addInline(child, passage, source);
}

// 글 조각의 글자를 원문에서 앞으로 찾아 가며 위치를 붙인다. 원문에는 조각 글에 없는 것(인용 표시 >,
// 탈출 문자 \, 줄 앞 들여쓰기)이 끼어 있을 수 있어서다. 줄바꿈은 띄어쓰기로 바꿔, 줄을 넘는 구절도
// 허용 목록과 맞춰 본다.
function addValue(value: string, start: number, end: number, passage: Passage, source: string) {
  let cursor = start;
  for (const char of value) {
    const found = source.indexOf(char, cursor);
    const at = found !== -1 && found < end ? found : cursor;
    passage.text += char === "\n" ? " " : char;
    for (let k = 0; k < char.length; k++) passage.origin.push(at + k);
    cursor = at + char.length;
  }
}

// 원문 위치를 1부터 세는 줄·칸으로 바꾼다.
function lineStarts(source: string): number[] {
  const starts = [0];
  for (let k = source.indexOf("\n"); k !== -1; k = source.indexOf("\n", k + 1)) starts.push(k + 1);
  return starts;
}

function locate(starts: number[], offset: number): { line: number; column: number } {
  let line = 0;
  while (line + 1 < starts.length && (starts[line + 1] ?? 0) <= offset) line++;
  return { line, column: offset - (starts[line] ?? 0) };
}

export function findAvoidedWords(input: {
  glossary: string;
  docs: Doc[];
  allowlist: AllowEntry[];
}): Hit[] {
  const avoided = readGlossary(input.glossary);
  const hits: Hit[] = [];
  for (const doc of input.docs) {
    const lines = doc.text.split(/\r?\n/);
    const starts = lineStarts(doc.text);
    for (const passage of passages(doc.text)) {
      const tokens = eojeols(passage.text);
      tokens.forEach((_, i) => {
        for (const { word, term } of avoided) {
          for (const at of matchesAt(tokens, i, word)) {
            const offset = passage.origin[at];
            if (offset === undefined || allowed(input.allowlist, passage.text, word, at)) continue;
            const where = locate(starts, offset);
            hits.push({
              path: doc.path,
              line: where.line + 1,
              column: where.column + 1,
              word,
              term,
              text: lines[where.line] ?? "",
            });
          }
        }
      });
    }
  }
  return hits;
}
