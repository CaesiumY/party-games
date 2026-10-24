import type { DiceSource } from "./dice-source";
import type { DieValue } from "./types";

/**
 * 테스트용 빌드(`vite build --mode e2e`)에만 들어가는 표식. 운영 빌드 검사(scripts/check-build.ts)가
 * 빌드 결과물에서 이 글자를 찾아, 있으면 실패한다. E2E 테스트는 이 값으로 테스트용 공급원이 켜졌는지 본다.
 */
export const E2E_DICE_SOURCE_MARKER = "yacht:e2e-dice-source";

type Five = readonly [DieValue, DieValue, DieValue, DieValue, DieValue];

/**
 * 첫 굴림의 눈. [플레이어][턴 - 1]. 플레이어 1 은 턴마다 점수표 순서의 카테고리에 좋은 눈이 나오고
 * (윗칸 소계 63 → 보너스), 플레이어 2 는 그보다 못한 눈이 나와(포 다이스·요트는 스크래치) 플레이어 1 이 이긴다.
 * 눈은 일부러 섞어 두어 정렬 줄이 오름차순으로 다시 놓는지도 보인다.
 */
const FIRST_ROLLS: readonly (readonly Five[])[] = [
  [
    [4, 1, 6, 1, 5], // 에이스: 1 두 개를 홀드하고 더 굴린다(아래 LATER_ROLLS)
    [2, 4, 2, 5, 2], // 듀스 6
    [3, 1, 3, 2, 3], // 트레이 9
    [4, 2, 4, 1, 4], // 포 12
    [5, 1, 5, 2, 5], // 파이브 15
    [6, 2, 6, 1, 6], // 식스 18 → 소계 63, 보너스 +35
    [6, 5, 4, 6, 5], // 초이스 26
    [4, 4, 2, 4, 4], // 포 다이스 18
    [5, 3, 3, 5, 3], // 풀 하우스 19
    [6, 1, 3, 2, 4], // S. 스트레이트 15
    [5, 2, 6, 3, 4], // L. 스트레이트 30
    [6, 6, 6, 6, 6], // 요트 50
  ],
  [
    [3, 1, 4, 1, 2], // 에이스 2
    [5, 2, 1, 2, 3], // 듀스 4
    [5, 3, 1, 3, 2], // 트레이 6
    [1, 4, 5, 4, 2], // 포 8
    [3, 5, 1, 5, 2], // 파이브 10
    [6, 3, 1, 6, 2], // 식스 12 → 소계 42, 보너스 +0
    [6, 2, 1, 4, 2], // 초이스 15
    [2, 5, 2, 3, 2], // 포 다이스 0 (스크래치)
    [3, 2, 3, 2, 3], // 풀 하우스 13
    [4, 1, 4, 3, 2], // S. 스트레이트 15
    [5, 4, 3, 2, 1], // L. 스트레이트 30
    [1, 2, 1, 1, 1], // 요트 0 (스크래치)
  ],
  [[2, 5, 3, 6, 4]],
  [[6, 1, 4, 2, 3]],
];

/** 두 번째 이후 굴림의 눈. 키는 "플레이어/턴/굴림 번호". 앞에서부터 굴릴 개수만큼 쓴다. */
const LATER_ROLLS: Readonly<Record<string, Five>> = {
  "0/1/2": [3, 1, 2, 6, 6],
  "0/1/3": [3, 2, 6, 6, 6],
};

/** 표에 없는 굴림의 눈. 같은 (플레이어, 턴, 굴림 번호)면 언제나 같다. */
function fallback(player: number, turn: number, rollNumber: number): Five {
  const value = (i: number) =>
    (((player * 7 + turn * 3 + rollNumber * 5 + i * 2) % 6) + 1) as DieValue;
  return [value(0), value(1), value(2), value(3), value(4)];
}

/**
 * E2E 테스트용 주사위 공급원(스펙 「주사위 공급원」). 눈은 (플레이어, 턴, 굴림 번호)만으로 정해져서,
 * 새로고침 뒤에도 같은 굴림이면 같은 눈이 나온다. 정해 둔 다섯 눈 가운데 앞에서부터 굴릴 개수만큼 낸다.
 */
export function createE2EDiceSource(): DiceSource {
  return ({ player, turn, rollNumber, count }) => {
    const planned =
      rollNumber === 1
        ? FIRST_ROLLS[player]?.[turn - 1]
        : LATER_ROLLS[`${player}/${turn}/${rollNumber}`];
    return (planned ?? fallback(player, turn, rollNumber)).slice(0, count);
  };
}
