/** 한 번의 부딪힘. `at` 은 울릴 시각(초), `strength` 는 부딪힌 세기(속도 변화, 초속). */
export interface Hit {
  at: number;
  strength: number;
}

/** 울릴 충돌음 하나. `gain` 은 0~1 의 소리 크기. */
export interface ScheduledHit {
  at: number;
  gain: number;
}

/** 동시에 겹쳐 울리는 충돌음의 최대 개수(스펙 「소리」: 한꺼번에 너무 많이 겹쳐 울리지 않게). */
export const MAX_VOICES = 4;
/** 충돌음 하나가 울리는 동안으로 보는 시간(초). 이 안에 시작한 소리끼리는 겹친 것이다. */
const VOICE_SECONDS = 0.15;
/** 이 세기 이상이면 가장 크게 울린다. */
const FULL_STRENGTH = 5;
/** 아무리 약하게 스쳐도 이만큼은 울린다. */
const MIN_GAIN = 0.15;

/**
 * 부딪힘 목록을 실제로 울릴 충돌음 일정으로 바꾼다. 세게 부딪힐수록 크게 울리고,
 * 같은 때 울리는 소리가 `MAX_VOICES` 개를 넘으면 센 것부터 남기고 나머지는 울리지 않는다.
 */
export function hitSchedule(hits: readonly Hit[]): ScheduledHit[] {
  const kept: Hit[] = [];
  for (const hit of [...hits].sort((a, b) => b.strength - a.strength)) {
    const overlapping = kept.filter((k) => Math.abs(k.at - hit.at) < VOICE_SECONDS).length;
    if (overlapping < MAX_VOICES) kept.push(hit);
  }
  return kept
    .sort((a, b) => a.at - b.at)
    .map((hit) => ({
      at: hit.at,
      gain: Math.min(Math.max(hit.strength / FULL_STRENGTH, MIN_GAIN), 1),
    }));
}
