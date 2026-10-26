import type { SoundClips } from "./sound";

const SOUNDS = `${import.meta.env.BASE_URL}sounds/`;

/**
 * 음원 파일 목록. 파일은 `public/sounds/`, 출처와 라이선스(CC0)와 자른 방법은 `public/sounds/CREDITS.md`.
 * 컵 흔들기는 반복해도 이음매가 없게 만든 2초짜리 하나, 충돌음은 주사위 하나가 펠트에 닿는 짧은 소리 일곱 개다.
 * 충돌음은 번갈아 써서 같은 소리가 이어 나지 않게 한다. 반복 재생과 시작 시각이 정확하도록 앞뒤 여백이 없는 WAV 를 쓴다.
 */
export const SOUND_CLIPS: SoundClips = {
  shake: [`${SOUNDS}shake.wav`],
  hit: [1, 2, 3, 4, 5, 6, 7].map((n) => `${SOUNDS}hit-${n}.wav`),
};

/** 브라우저에서 음원 파일을 받는다. 받지 못하면 그 소리만 빠진다. */
export async function fetchClip(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
}
