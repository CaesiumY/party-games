/** 연출 구현 두 갈래. instant 는 '동작 줄이기' 경로이자 첫 구현이다. */
export interface PresenterChoices<P> {
  instant: P;
  animated: P;
}

/** '동작 줄이기'가 켜져 있으면 언제나 순간 배치를 고른다. */
export function choosePresenter<P>(reducedMotion: boolean, choices: PresenterChoices<P>): P {
  return reducedMotion ? choices.instant : choices.animated;
}
