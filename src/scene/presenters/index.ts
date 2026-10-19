import type { PresenterChoices } from "../choose-presenter";
import type { RollPresenter } from "../roll-presenter";
import { InstantPresenter } from "./instant-presenter";

/**
 * 연출 구현 등록부. 물리 연출(#5)은 `animated` 만 바꿔 끼운다.
 * '동작 줄이기'가 켜져 있으면 choosePresenter 가 언제나 `instant` 를 고른다.
 */
export const PRESENTERS: PresenterChoices<RollPresenter> = {
  instant: InstantPresenter,
  animated: InstantPresenter,
};
