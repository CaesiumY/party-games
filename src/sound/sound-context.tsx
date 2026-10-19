import { createContext, type ReactNode, useContext, useEffect } from "react";
import { useGame } from "../store/store-context";
import { type RollSound, type Sound, silentSound } from "./sound";

const SoundContext = createContext<Sound>(silentSound);

/** 효과음을 화면과 3D 장면에 건넨다. 저장소의 음소거 설정을 효과음에 옮긴다. */
export function SoundProvider({ sound, children }: { sound: Sound; children: ReactNode }) {
  const muted = useGame((s) => s.muted);
  useEffect(() => {
    sound.setMuted(muted);
  }, [sound, muted]);
  return <SoundContext.Provider value={sound}>{children}</SoundContext.Provider>;
}

/** 효과음. 굴림 버튼이 첫 탭에서 `unlock` 을 부른다. */
export function useSound(): Sound {
  return useContext(SoundContext);
}

/** 굴림 연출이 내는 소리. '동작 줄이기'가 켜져 있으면 굴러가는 소리를 내지 않는다(스펙 「소리」). */
export function useRollSound(): RollSound {
  const sound = useSound();
  const reducedMotion = useGame((s) => s.reducedMotion);
  return reducedMotion ? silentSound : sound;
}
