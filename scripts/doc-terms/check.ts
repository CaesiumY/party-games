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

// 피할 말이 어절 i 에서 시작하면 줄 안의 위치를, 아니면 null 을 돌려준다.
// 여러 어절로 된 말은 그만큼의 어절을 이어 붙여 본다. 두 글자 이상은 그 말로 시작하면(조사가
// 붙어도) 걸린다.
function matchAt(tokens: Eojeol[], i: number, word: string): number | null {
  const first = tokens[i];
  if (first === undefined) return null;
  if (word.length === 1) return matchOneLetter(first, word);
  const count = word.split(" ").length;
  if (i + count > tokens.length) return null;
  const joined = tokens
    .slice(i, i + count)
    .map((t) => t.raw)
    .join(" ");
  // 어절 첫머리와, 첫 어절 안에서 문장부호 바로 뒤(「방법」·「족보」 의 '족보')에서 시작해 본다.
  for (const m of first.raw.matchAll(/(?:^|[\p{P}\p{S}])(?=[^\p{P}\p{S}])/gu)) {
    const from = m.index + m[0].length;
    if (joined.startsWith(word, from)) return first.start + from;
  }
  return null;
}

// 한 글자는 그 말만으로 된 어절일 때만 걸린다('통과'는 '통'이 아니다). 낫표·따옴표·괄호도
// 어절의 경계로 본다(「킵」이다 의 '킵' 은 그 말만으로 된 말이다).
function matchOneLetter(token: Eojeol, word: string): number | null {
  for (const m of token.raw.matchAll(/[^\p{P}\p{S}]+/gu)) {
    if (m[0] === word) return token.start + m.index;
  }
  return null;
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

export function findAvoidedWords(input: {
  glossary: string;
  docs: Doc[];
  allowlist: AllowEntry[];
}): Hit[] {
  const avoided = readGlossary(input.glossary);
  const hits: Hit[] = [];
  for (const doc of input.docs) {
    doc.text.split(/\r?\n/).forEach((text, index) => {
      const tokens = eojeols(text);
      tokens.forEach((_, i) => {
        for (const { word, term } of avoided) {
          const at = matchAt(tokens, i, word);
          if (at !== null && !allowed(input.allowlist, text, word, at)) {
            hits.push({ path: doc.path, line: index + 1, column: at + 1, word, term, text });
          }
        }
      });
    });
  }
  return hits;
}
