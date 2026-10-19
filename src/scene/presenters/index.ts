import type { PresenterChoices } from "../choose-presenter";
import type { RollPresenter } from "../roll-presenter";
import { InstantPresenter } from "./instant-presenter";
import { PhysicsPresenter } from "./physics-presenter";

/**
 * 연출 구현 등록부. `animated` 는 물리 굴림 연출이다.
 * '동작 줄이기'가 켜져 있으면 choosePresenter 가 언제나 `instant` 를 고른다.
 */
export const PRESENTERS: PresenterChoices<RollPresenter> = {
  instant: InstantPresenter,
  animated: PhysicsPresenter,
};
