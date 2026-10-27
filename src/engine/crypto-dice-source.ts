import type { DiceSource } from "./dice-source";
import type { DieValue } from "./types";

type FillRandom = (buffer: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

/** 표준 Web Crypto(브라우저와 Node 모두에 있음)로 난수 바이트를 채운다. */
const webCryptoFill: FillRandom = (buffer) => globalThis.crypto.getRandomValues(buffer);

/** 252 = 6 × 42. 이보다 작은 바이트만 쓰면 여섯 눈이 똑같은 확률로 나온다. */
const UNBIASED_LIMIT = 252;

/**
 * 운영 빌드의 주사위 공급원. 암호학적으로 안전한 난수를 쓴다.
 * 플레이어·턴·굴림 번호는 결과에 쓰지 않는다(테스트·온라인 공급원만 쓴다).
 */
export function createCryptoDiceSource(fill: FillRandom = webCryptoFill): DiceSource {
  return ({ count }) => {
    const values: DieValue[] = [];
    const buffer = new Uint8Array(count);
    while (values.length < count) {
      fill(buffer);
      for (const byte of buffer) {
        if (values.length === count) break;
        if (byte < UNBIASED_LIMIT) values.push(((byte % 6) + 1) as DieValue);
      }
    }
    return values;
  };
}
