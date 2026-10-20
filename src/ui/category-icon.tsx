import type { Category } from "../engine/types";

const SIZE = 12;

/** 윗칸: 그 눈의 주사위 면(검은 네모에 바탕색 눈). 좌표는 면의 백분율. */
const PIPS: Partial<Record<Category, readonly (readonly [number, number])[]>> = {
  aces: [[50, 50]],
  deuces: [
    [28, 28],
    [72, 72],
  ],
  treys: [
    [25, 25],
    [50, 50],
    [75, 75],
  ],
  fours: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  fives: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  sixes: [
    [28, 22],
    [72, 22],
    [28, 50],
    [72, 50],
    [28, 78],
    [72, 78],
  ],
};

/** 아랫칸: 원작처럼 작은 네모 여러 개로 그 카테고리의 주사위 모양을 그린다. 좌표는 px(12×12 안). */
const MARKS: Partial<Record<Category, readonly (readonly [number, number])[]>> = {
  choice: [
    [2, 2],
    [10, 2],
    [6, 6],
    [2, 10],
    [10, 10],
  ],
  fourDice: [
    [3, 3],
    [9, 3],
    [3, 9],
    [9, 9],
  ],
  fullHouse: [
    [1.5, 4],
    [6, 4],
    [10.5, 4],
    [3.5, 9],
    [8.5, 9],
  ],
  sStraight: [
    [1.5, 2],
    [4.5, 5],
    [7.5, 8],
    [10.5, 11],
  ],
  lStraight: [
    [1, 1],
    [3.5, 3.5],
    [6, 6],
    [8.5, 8.5],
    [11, 11],
  ],
  yacht: [
    [6, 1.5],
    [2, 5],
    [10, 5],
    [4, 10],
    [8, 10],
  ],
};

/**
 * 점수표 카테고리 이름 앞의 작은 그림(원작 한국어판 점수표). 꾸밈이라 화면 낭독기에서는 빠지고,
 * 카테고리 버튼의 접근 이름은 이름 글자 그대로다.
 */
export function CategoryIcon({ category }: { category: Category }) {
  const pips = PIPS[category];
  return (
    <svg
      className="cat-icon"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      focusable="false"
    >
      {pips ? (
        <>
          <rect width={SIZE} height={SIZE} rx={2.5} fill="currentColor" />
          {pips.map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={(x / 100) * SIZE}
              cy={(y / 100) * SIZE}
              r={1.25}
              className="cat-icon-pip"
            />
          ))}
        </>
      ) : (
        (MARKS[category] ?? []).map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x - 1.4}
            y={y - 1.4}
            width={2.8}
            height={2.8}
            rx={0.6}
            fill="currentColor"
          />
        ))
      )}
    </svg>
  );
}
