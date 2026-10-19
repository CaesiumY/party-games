import type { SoundClips } from "./sound";

/**
 * 음원 파일 목록. 파일은 `public/sounds/` 에 두고, 출처와 라이선스(CC0)는 `public/sounds/CREDITS.md` 에 적는다.
 * 음원은 도입 전에 사용자 승인을 받는다(스펙 「소리」). 승인 전에는 비어 있어 소리가 나지 않는다.
 */
export const SOUND_CLIPS: SoundClips = {
  shake: [],
  hit: [],
};

/** 브라우저에서 음원 파일을 받는다. 받지 못하면 그 소리만 빠진다. */
export async function fetchClip(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
}
