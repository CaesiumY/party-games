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
function allowed(allowlist: AllowEntry[], line: string, word: string, at: number): boolean {
  return allowlist.some(
    ({ word: allowedWord, phrase }) =>
      allowedWord === word &&
      positionsOf(line, phrase).some(
        (from) => from <= at && at + word.length <= from + phrase.length,
      ),
  );
}

function positionsOf(line: string, phrase: string): number[] {
  const positions: number[] = [];
  for (let from = line.indexOf(phrase); from !== -1; from = line.indexOf(phrase, from + 1)) {
    positions.push(from);
  }
  return positions;
}

// 링크 정의 줄(`[이름]: 주소`). 글이 아니라 주소라서 검사하지 않고, 이름은 참조 링크를 알아보는 데 쓴다.
const LINK_DEFINITION = /^\s{0,3}\[([^\]]+)\]:\s*\S/;

function linkReferences(lines: string[]): Set<string> {
  const refs = new Set<string>();
  for (const line of lines) {
    const ref = LINK_DEFINITION.exec(line)?.[1];
    if (ref !== undefined) refs.add(ref.toLowerCase());
  }
  return refs;
}

// 줄에서 인라인 마크다운 표시(강조 *·_, 코드 `, 링크의 괄호와 주소·참조 이름)를 걷어 낸 글과,
// 걷어 낸 글의 각 글자가 원래 줄의 몇 번째 글자였는지를 돌려준다. `파티 **모드**` 도 `파티 모드` 로
// 맞춰 보고, 보고하는 위치는 원래 줄 기준으로 남기기 위해서다.
// 링크는 [글](주소), [글][참조], [글][] 이고, [글] 하나만 쓴 것은 같은 이름의 링크 정의가 있을 때만 링크다.
function prose(line: string, refs: Set<string>): { text: string; origin: number[] } {
  const dropped = new Array<boolean>(line.length).fill(false);
  for (const m of line.matchAll(/\[([^\]]*)\](\([^)]*\)|\[[^\]]*\])?/g)) {
    const label = m[1] ?? "";
    if (m[2] === undefined && !refs.has(label.toLowerCase())) continue;
    dropped[m.index] = true;
    for (let k = m.index + 1 + label.length; k < m.index + m[0].length; k++) dropped[k] = true;
  }
  for (const m of line.matchAll(/[*_`]/g)) dropped[m.index] = true;
  const origin = Array.from({ length: line.length }, (_, k) => k).filter((k) => !dropped[k]);
  return { text: origin.map((k) => line[k]).join(""), origin };
}

// 맞춰 보는 덩어리. 한 문단의 줄들을 띄어쓰기 하나로 이은 글과, 그 글의 각 글자가 원래 몇 번째
// 줄(0부터)의 몇 번째 글자였는지를 함께 든다.
type Passage = { text: string; origin: { line: number; column: number }[] };

// 다음 줄과 이어질 수 없는 줄(제목·표의 줄)과, 앞 줄에 이어지지 않고 새 블록을 여는 줄(제목·목록
// 항목·표의 줄). 인용 표시(>)는 먼저 걷어 낸 뒤 그 안의 글에 이 규칙을 쓴다.
const STANDALONE = /^\s*(#{1,6}\s|\|)/;
const BLOCK_START = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/;
const QUOTE = /^(?:\s{0,3}>\s?)+/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

// 코드 블록을 여는 표시라면 그 표시를, 아니면 null 을 돌려준다.
function fenceOpening(line: string): string | null {
  return FENCE.exec(line)?.[1] ?? null;
}

// 열린 코드 블록(opening)을 닫는 줄인지. 같은 글자로 같거나 더 길게 쓰고 뒤에 다른 글이 없어야 한다.
function closesFence(line: string, opening: string): boolean {
  const m = FENCE.exec(line);
  const run = m?.[1];
  return (
    run !== undefined &&
    run[0] === opening[0] &&
    run.length >= opening.length &&
    (m?.[2] ?? "").trim() === ""
  );
}

// 마크다운의 부드러운 줄바꿈(빈 줄 없이 이어 쓴 줄)은 한 문단이라 이어서 맞춰 본다. 빈 줄·제목·
// 목록 항목·표의 줄·코드 블록에서는 잇지 않는다. 코드 블록 안의 줄은 한 줄씩 따로 본다.
// 인용 블록은 표시를 걷어 내고 인용 줄끼리만 잇는다. 빈 인용 줄(>)이나 인용 밖 줄에서 끊는다.
function passages(lines: string[]): Passage[] {
  const result: Passage[] = [];
  let open: { passage: Passage; quoted: boolean } | null = null;
  // 열려 있는 코드 블록의 여는 표시(``` 나 ~~~ 의 줄). 없으면 null.
  let fence: string | null = null;
  const refs = linkReferences(lines);
  lines.forEach((line, index) => {
    const inFence = fence !== null;
    if (fence !== null) {
      if (closesFence(line, fence)) fence = null;
    } else {
      fence = fenceOpening(line);
    }
    if (!inFence && LINK_DEFINITION.test(line)) {
      open = null;
      return;
    }
    const marker = inFence ? "" : (QUOTE.exec(line)?.[0] ?? "");
    const quoted = marker !== "";
    const body = line.slice(marker.length);
    const alone = inFence || fence !== null || body.trim() === "" || STANDALONE.test(body);
    const plain = prose(body, refs);
    const origin = plain.origin.map((k) => ({ line: index, column: marker.length + k }));
    if (open !== null && open.quoted === quoted && !alone && !BLOCK_START.test(body)) {
      open.passage.origin.push({ line: index, column: 0 }, ...origin);
      open.passage.text += ` ${plain.text}`;
    } else {
      open = { passage: { text: plain.text, origin }, quoted };
      result.push(open.passage);
    }
    if (alone) open = null;
  });
  return result;
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
    // 맞춰 보기와 허용 목록은 표시를 걷어 내고 문단을 이은 글에서, 보고하는 위치는 원래 줄에서.
    for (const passage of passages(lines)) {
      const tokens = eojeols(passage.text);
      tokens.forEach((_, i) => {
        for (const { word, term } of avoided) {
          for (const at of matchesAt(tokens, i, word)) {
            const where = passage.origin[at];
            if (where === undefined || allowed(input.allowlist, passage.text, word, at)) continue;
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
