import type { Die } from "../engine/types";

/**
 * 열 규칙(스펙 「3D 장면」): 주사위마다 열(0 = 왼쪽 … 4 = 오른쪽)이 있다.
 * 결과는 DieId 순서의 배열이다. columns[dieId] = 열.
 * 엔진은 순서를 저장하지 않는다. 열은 화면이 정하는 표현이다.
 */

/** 게임 시작 때의 열. 주사위 번호 순서. */
export function initialColumns(): number[] {
  return [0, 1, 2, 3, 4];
}

/**
 * 굴림이 끝날 때 다시 받는 열. 지금은 홀드가 없어서 다섯 개를 눈 오름차순으로 놓는다
 * (같은 눈은 주사위 번호 순).
 * TODO(#7): 홀드한 주사위는 왼쪽 열부터, 나머지는 그 오른쪽 열부터, 3번째 굴림 뒤 예외.
 */
export function lineupColumns(dice: readonly Die[]): number[] {
  const order = [...dice].sort((a, b) => a.value - b.value || a.id - b.id);
  const columns = initialColumns();
  order.forEach((die, column) => {
    columns[die.id] = column;
  });
  return columns;
}
