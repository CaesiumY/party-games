import { MAX_PLAYERS } from "../store/player-cap";

/**
 * 시작 화면의 인원 선택지. 1명이면 연습 모드, 2명 이상이면 대전 모드다. 지금은 2명까지만 연다
 * (`MAX_PLAYERS`, 2026-10-25 결정). 엔진은 4명까지 다룰 수 있다.
 */
export const PLAYER_COUNTS: readonly number[] = Array.from(
  { length: MAX_PLAYERS },
  (_, i) => i + 1,
);

/** 이름 입력의 최대 글자 수. 4인 점수표의 세로줄 머리에도 들어가도록 짧게 둔다(3~4명을 다시 열 때를 위해 그대로 둔다). */
export const NAME_MAX_LENGTH = 8;

/** 비워 둔 이름에 들어가는 기본 이름(스펙 「게임 시작」). */
export function defaultName(player: number): string {
  return `플레이어 ${player + 1}`;
}

/** 이름 뒤에 번호를 붙인다. 합쳐서 최대 글자 수를 넘으면 이름의 앞부분만 남긴다. */
function numbered(base: string, n: number): string {
  const suffix = ` ${n}`;
  return `${base.slice(0, NAME_MAX_LENGTH - suffix.length)}${suffix}`;
}

/**
 * 시작 화면의 입력을 게임의 플레이어 이름으로 바꾼다. 점수표·배너·순위에서 누구인지 구분해야 해서 이름이 겹치지 않게 한다.
 * - 앞뒤 공백을 지운다.
 * - 직접 넣은 이름끼리 겹치면 뒤의 것에 " 2", " 3" 을 붙이고, 그래서 최대 글자 수를 넘으면 앞부분을 잘라 맞춘다.
 * - 비운 칸은 자리 번호의 「플레이어 n」이다. 그 이름이 이미 쓰였으면 겹치지 않는 가장 작은 「플레이어 n」을 쓴다.
 */
export function playerNames(inputs: readonly string[]): string[] {
  const trimmed = inputs.map((input) => input.trim());
  const names: (string | null)[] = [];
  const used = new Set<string>();
  // 직접 넣은 이름이 먼저 자리를 잡는다. 기본 이름이 그 이름을 피해야 하기 때문이다.
  for (const base of trimmed) {
    if (!base) {
      names.push(null);
      continue;
    }
    let name = base;
    for (let n = 2; used.has(name); n++) name = numbered(base, n);
    used.add(name);
    names.push(name);
  }
  return names.map((name, i) => {
    if (name !== null) return name;
    let fallback = defaultName(i);
    for (let n = 0; used.has(fallback); n++) fallback = defaultName(n);
    used.add(fallback);
    return fallback;
  });
}
