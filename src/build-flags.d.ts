/** 테스트용 빌드(`--mode e2e`)에서만 참. vite.config.ts 의 define 이 넣는다. */
declare const __E2E_DICE_SOURCE__: boolean;

interface Window {
  /** 테스트용 빌드에서 E2E 용 주사위 공급원을 쓰고 있으면 그 표식. E2E 테스트가 확인한다. */
  __yachtDiceSource?: string;
}
