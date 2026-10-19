import type { ComponentType } from "react";
import { DiceButtons } from "../a11y/dice-buttons";
import { Actions } from "./actions";
import { CurrentPlayer, RollsLeft } from "./board-overlays";
import { BonusNoticeView, ComboCallout } from "./notices";
import { Scorecard } from "./scorecard";

/** 판 영역 위에 겹치는 요소의 표시. src/scene/board-3d.tsx 의 OVERLAY_ATTR 와 같다. */
const overlay = { "data-board-overlay": "" };

/**
 * 게임 화면. 세로가 가로보다 길거나 같으면 세로 배치(위 판, 아래 점수표, 버튼은 판 왼쪽 아래에 겹침),
 * 가로가 더 길면 가로 배치(왼쪽 점수표, 오른쪽 판과 그 아래 버튼). 배치는 CSS 가 화면 비율로 고른다.
 * `Board` 는 3D 판 영역이다. 테스트에서는 캔버스 없는 대역을 넣는다.
 */
export function GameScreen({ Board }: { Board: ComponentType }) {
  return (
    <main className="game">
      <Board />
      <RollsLeft overlayAttr={overlay} />
      <CurrentPlayer overlayAttr={overlay} />
      <Actions overlayAttr={overlay} />
      <ComboCallout />
      <BonusNoticeView />
      <Scorecard />
      <DiceButtons />
    </main>
  );
}
