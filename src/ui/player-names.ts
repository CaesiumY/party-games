/** 플레이어 수. 1명이면 연습 모드, 2~4명이면 대전 모드다. */
export const PLAYER_COUNTS = [1, 2, 3, 4] as const;

/** 이름 입력의 최대 글자 수. 4인 점수표의 세로줄 머리에 들어가도록 짧게 둔다. */
export const NAME_MAX_LENGTH = 8;

/** 비워 둔 이름에 들어가는 기본 이름(스펙 「게임 시작」). */
export function defaultName(player: number): string {
  return `플레이어 ${player + 1}`;
}

/**
 * 시작 화면의 입력을 게임의 플레이어 이름으로 바꾼다. 앞뒤 공백을 지우고, 비었으면 기본 이름을 넣는다.
 * 같은 이름이 또 나오면 뒤의 것에 " 2", " 3" 을 붙인다. 점수표·배너·순위에서 누구인지 구분해야 해서다.
 */
export function playerNames(inputs: readonly string[]): string[] {
  const names: string[] = [];
  for (const [i, input] of inputs.entries()) {
    const base = input.trim() || defaultName(i);
    let name = base;
    for (let n = 2; names.includes(name); n++) name = `${base} ${n}`;
    names.push(name);
  }
  return names;
}
