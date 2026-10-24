import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * 캔버스에 그려 만드는 텍스처. 장면이 처음 쓸 때 한 번만 만들고 공유한다(그리는 비용은 처음 한 번뿐).
 * 2D 컨텍스트가 없는 환경(jsdom)에서는 빈 텍스처가 된다.
 */
export function canvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * 바탕색 위에 1~3px 점을 흩뿌린다(펠트·가죽의 결). 점의 반은 검정, 반은 흰색(흰색은 더 옅게)이고
 * 투명도는 `alpha` 이하다.
 */
export function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  base: string,
  alpha: number,
  count: number,
) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * alpha;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`;
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      1 + Math.random() * 2,
      1 + Math.random() * 2,
    );
  }
}
