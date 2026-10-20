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
  // 고칠 말(용어집의 표제어). 한 피할 말이 여러 용어의 피할 말이면(예: '라운드' → 게임·턴) 모두 든다.
  terms: string[];
  text: string;
};

type Avoided = { word: string; terms: string[] };

const HEADWORD = /^\*\*(.+?) \(.+\)\*\*:/;
const AVOID = /^_Avoid_:\s*(.*)$/;

// 같은 피할 말은 하나로 묶어, 같은 자리가 용어마다 따로 세어지지 않게 한다.
function readGlossary(glossary: string): Avoided[] {
  const avoided = new Map<string, string[]>();
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
      for (const raw of avoid[1].replace(/\([^)]*\)/g, "").split(",")) {
        const word = raw.trim();
        const terms = avoided.get(word) ?? [];
        if (!terms.includes(term)) terms.push(term);
        avoided.set(word, terms);
      }
    }
  }
  // 피할 말이 다른 용어의 표제어이면(예: '기록') 그 말은 제 뜻으로 쓰이므로 검사하지 않는다.
  return [...avoided]
    .filter(([word]) => !headwords.has(word))
    .map(([word, terms]) => ({ word, terms }));
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
// 뒤쪽은 막지 않아서 조사가 붙어도 된다. 피할 말을 찾을 때처럼 띄어쓰기는 몇 칸이든 한 칸으로 본다
// ('조작  잠금' 도 '조작 잠금' 이다).
function allowed(allowlist: AllowEntry[], line: string, word: string, at: number): boolean {
  const { text, toCollapsed } = collapseSpaces(line);
  const start = toCollapsed[at] ?? at;
  return allowlist.some(({ word: allowedWord, phrase }) => {
    if (allowedWord !== word) return false;
    const wanted = phrase.replace(/\s+/g, " ");
    return positionsOf(text, wanted).some(
      (from) =>
        startsEojeol(text, from, wanted) &&
        from <= start &&
        start + word.length <= from + wanted.length,
    );
  });
}

// 띄어쓰기가 이어진 곳을 한 칸으로 줄인 글과, 원래 글의 각 위치가 줄인 글의 몇 번째인지.
function collapseSpaces(line: string): { text: string; toCollapsed: number[] } {
  let text = "";
  const toCollapsed: number[] = [];
  for (let k = 0; k < line.length; k++) {
    const char = line[k] ?? "";
    const space = /\s/.test(char);
    if (space && /\s/.test(line[k - 1] ?? "")) {
      toCollapsed.push(text.length - 1);
      continue;
    }
    toCollapsed.push(text.length);
    text += space ? " " : char;
  }
  return { text, toCollapsed };
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
// (목록·인용 안의 문단도 문단이다). 코드 블록·링크 정의·맨 앞의 YAML 머리말은 보지 않는다.
// HTML 은 스펙·ADR 에 쓰지 않으므로(findHtml 이 실패로 알림) 여기서는 건너뛰고, <br> 만 띄어쓰기로 본다.
// 링크는 글자만 보고 주소는 보지 않는다. 인라인 코드의 글자는 본다(문장 속 이름도 용어를 지켜야 해서).
type MdNode = {
  type: string;
  value?: string;
  alt?: string | null;
  children?: MdNode[];
  position?: {
    start: { offset?: number; line?: number; column?: number };
    end: { offset?: number };
  };
};

const PASSAGE = new Set(["paragraph", "heading", "tableCell"]);
const SKIPPED = new Set(["code", "html", "definition"]);
// 그림(![글](주소), ![글][참조])은 대체 글(alt)만 본다. 주소와 제목은 보지 않는다.
const IMAGE = new Set(["image", "imageReference"]);

// 파일 맨 앞의 YAML 머리말(--- 로 열고 --- 나 ... 로 닫는 줄들)을 같은 길이의 공백으로 지운다.
// 줄바꿈은 남기므로, 뒤 본문의 원문 위치(줄·칸)가 그대로다. 해석기에는 빈 줄로 보인다.
// 사이의 줄이 모두 YAML 모양일 때만 머리말로 본다. 아니면 문서가 가로줄(---)로 시작한 것이라
// 보통 마크다운으로 검사한다.
function blankFrontmatter(source: string): string {
  const open = /^---[ \t]*\r?\n/.exec(source);
  if (open === null) return source;
  // CRLF 문서도 닫는 줄에서 끝나도록 \r 을 허용한다(JS 의 여러 줄 모드 $ 는 \r 앞에서도 맞지만 드러내 둔다).
  const close = /^(?:---|\.\.\.)[ \t]*\r?$/m.exec(source.slice(open[0].length));
  if (close === null) return source;
  const body = source.slice(open[0].length, open[0].length + close.index);
  if (!body.split(/\r?\n/).every((line) => YAML_LINE.test(line))) return source;
  const end = open[0].length + close.index + close[0].length;
  return source.slice(0, end).replace(/[^\r\n]/g, " ") + source.slice(end);
}

// YAML 모양의 줄: 빈 줄, # 주석, `키:` / `키: 값`, `- 항목`, 들여쓴 이어짐 줄. 키는 따옴표로 감싸도 된다.
const YAML_LINE =
  /^(?:\s*|\s*#.*|(?:[\w.-]+|"[^"]*"|'[^']*')[ \t]*:(?:[ \t].*)?|\s*-(?:[ \t].*)?|[ \t]+\S.*)\r?$/u;

// 덩어리의 글과, 그 글의 각 글자가 원문의 몇 번째 글자였는지.
type Passage = { text: string; origin: number[] };

function parse(source: string): MdNode {
  return fromMarkdown(source, {
    // 한 개짜리 ~ 는 취소선으로 읽지 않는다. 스펙에 흔한 '1~4명' 과 피할 말 '1~6칸' 이 한 문단에
    // 있으면 그 사이를 취소선으로 읽어 ~ 를 지워 버리기 때문이다. ~~두 개~~ 는 취소선 그대로다.
    // mdast 쪽(gfmFromMarkdown)은 해석된 표시를 옮기기만 해서 따로 맞출 설정이 없다.
    extensions: [gfm({ singleTilde: false })],
    mdastExtensions: [gfmFromMarkdown()],
  }) as MdNode;
}

function passages(original: string): Passage[] {
  const source = blankFrontmatter(original);
  const result: Passage[] = [];
  const walk = (node: MdNode) => {
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
  const end = node.position?.end.offset ?? source.length;
  if (IMAGE.has(node.type)) {
    // 대체 글은 원문의 ![ 다음 글자부터 맞춘다.
    if (node.alt) addValue(node.alt, start + 2, end, passage, source);
    return;
  }
  if (node.value !== undefined) {
    addValue(node.value, start, end, passage, source);
    return;
  }
  for (const child of node.children ?? []) addInline(child, passage, source);
}

// 원문의 문자 참조(&copy;, &#169;, &#xA9;). 해석기는 이것을 한 글자(드물게 &NotEqualTilde; 처럼
// 두 글자)로 풀어 준다.
const CHARACTER_REFERENCE = /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{0,31});/y;

// 해석기가 준 글 조각(value)의 글자마다 원문 위치를 붙인다. 그 노드의 원문 구간(start~end) 안에서만,
// 글자와 원문을 나란히 짚어 가며 맞춘다. 원문에만 있는 것(인용 표시 >, 탈출 문자 \, 줄 앞 들여쓰기,
// 인라인 코드의 `)은 건너뛰고, 문자 참조는 푼 글자를 모두 그 참조가 시작한 자리에 붙인다(참조 바로
// 뒤에서 원문과 맞지 않는 글자는 그 참조가 풀린 둘째 글자로 본다).
// 줄바꿈은 띄어쓰기로 바꿔, 줄을 넘는 구절도 허용 목록과 맞춰 본다.
function addValue(value: string, start: number, end: number, passage: Passage, source: string) {
  let k = start;
  let reference: number | null = null;
  for (const char of value) {
    let at = end - 1;
    while (k < end) {
      if (source.startsWith(char, k)) {
        at = k;
        k += char.length;
        reference = null;
        break;
      }
      CHARACTER_REFERENCE.lastIndex = k;
      const found = char !== "&" ? CHARACTER_REFERENCE.exec(source) : null;
      if (found !== null) {
        at = k;
        reference = k;
        k += found[0].length;
        break;
      }
      // 문자 참조는 많아야 두 글자로 풀리므로, 참조 하나에 붙이는 둘째 글자는 하나뿐이다.
      if (reference !== null) {
        at = reference;
        reference = null;
        break;
      }
      k++;
    }
    passage.text += char === "\n" ? " " : char;
    for (let u = 0; u < char.length; u++) passage.origin.push(Math.max(at, start) + u);
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

export type HtmlHit = { path: string; line: number; column: number; text: string };

// 스펙·ADR 은 HTML 을 쓰지 않는다(<br> 만 허용). HTML 은 보이는 글자를 맞춰 보기가 어렵고(주석·속성·
// 블록 경계), 마크다운으로 다 쓸 수 있어서다. 해석기가 HTML 로 읽은 곳(블록과 인라인 태그)의 시작 자리를
// 알린다. 한 줄에 여러 태그(<span>…</span>)가 있으면 그 줄의 첫 자리 하나만 알린다.
export function findHtml(docs: Doc[]): HtmlHit[] {
  const hits: HtmlHit[] = [];
  for (const doc of docs) {
    const lines = doc.text.split(/\r?\n/);
    const reported = new Set<number>();
    const walk = (node: MdNode) => {
      const start = node.position?.start;
      if (node.type === "html" && !HTML_BREAK.test(node.value ?? "") && start?.line !== undefined) {
        if (!reported.has(start.line)) {
          reported.add(start.line);
          const text = lines[start.line - 1] ?? "";
          hits.push({ path: doc.path, line: start.line, column: start.column ?? 1, text });
        }
        return;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(parse(blankFrontmatter(doc.text)));
  }
  return hits;
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
        for (const { word, terms } of avoided) {
          for (const at of matchesAt(tokens, i, word)) {
            const offset = passage.origin[at];
            if (offset === undefined || allowed(input.allowlist, passage.text, word, at)) continue;
            const where = locate(starts, offset);
            hits.push({
              path: doc.path,
              line: where.line + 1,
              column: where.column + 1,
              word,
              terms,
              text: lines[where.line] ?? "",
            });
          }
        }
      });
    }
  }
  return hits;
}
