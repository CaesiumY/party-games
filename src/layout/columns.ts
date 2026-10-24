import type { Die, DieId } from "../engine/types";

/**
 * 열 규칙(스펙 「3D 장면」): 주사위마다 열(0 = 왼쪽 … 4 = 오른쪽)이 있다.
 * 열은 DieId 순서의 배열로 들고 다닌다. columns[dieId] = 열.
 * 엔진은 순서를 저장하지 않는다. 열과 줄은 화면이 정하는 표현이다.
 */

/** 주사위가 놓이는 줄. 판 위쪽의 홀드 자리, 판 가운데의 정렬 줄. */
export type Row = "hold" | "lineup";

/** 정렬이 끝난 주사위 하나가 놓이는 자리. */
export interface DieSlot {
  id: DieId;
  column: number;
  row: Row;
}

/** 게임 시작 때의 열. 주사위 번호 순서. */
export function initialColumns(): number[] {
  return [0, 1, 2, 3, 4];
}

const ascending = (a: Die, b: Die) => a.value - b.value || a.id - b.id;

/**
 * 굴림이 끝날 때 다시 받는 열. 다시 정렬은 이때만 한다(홀드·홀드 풀기는 열을 바꾸지 않는다).
 * 홀드한 주사위는 왼쪽 열부터, 나머지는 그 오른쪽 열부터 각각 눈 오름차순이다.
 * 3번째 굴림(`finalRoll`)이 끝나면 다섯 개를 합쳐 왼쪽 열부터 눈 오름차순이다.
 * 같은 눈은 주사위 번호 순.
 */
export function lineupColumns(
  dice: readonly Die[],
  { finalRoll = false }: { finalRoll?: boolean } = {},
): number[] {
  const order = finalRoll
    ? [...dice].sort(ascending)
    : [
        ...dice.filter((d) => d.held).sort(ascending),
        ...dice.filter((d) => !d.held).sort(ascending),
      ];
  const columns = initialColumns();
  order.forEach((die, column) => {
    columns[die.id] = column;
  });
  return columns;
}

/**
 * 주사위마다 놓이는 자리(DieId 순서). 홀드한 주사위는 홀드 자리, 나머지는 정렬 줄에 자기 열 그대로 놓인다.
 * `allUp`(3번째 굴림이 끝난 뒤)이면 홀드 여부와 상관없이 다섯 개 모두 홀드 자리다. 이는 표현일 뿐이다.
 */
export function diceSlots(
  dice: readonly Die[],
  columns: readonly number[],
  { allUp }: { allUp: boolean },
): DieSlot[] {
  return dice.map((die) => ({
    id: die.id,
    column: columns[die.id] ?? die.id,
    row: allUp || die.held ? "hold" : "lineup",
  }));
}

/** 화면에 보이는 순서: 홀드 자리의 주사위들, 그다음 정렬 줄의 주사위들, 각각 왼쪽 열부터. */
export function screenOrder(slots: readonly DieSlot[]): DieId[] {
  const rank = (s: DieSlot) => (s.row === "hold" ? 0 : 5) + s.column;
  return [...slots].sort((a, b) => rank(a) - rank(b)).map((s) => s.id);
}
