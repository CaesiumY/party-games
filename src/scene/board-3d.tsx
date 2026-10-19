import { Canvas, useThree } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import { applyFit, fitCamera, type Rect } from "../layout/camera-fit";
import { useGame } from "../store/store-context";
import { BoardMesh } from "./board-mesh";
import { choosePresenter } from "./choose-presenter";
import { type OverlayReserve, overlayReserve } from "./overlay-reserve";
import { PRESENTERS } from "./presenters";
import type { PresentedDie } from "./roll-presenter";

/** 판 영역 위에 겹치는 요소에 붙이는 표시. 카메라 맞춤이 이 요소들의 자리를 피한다. */
export const OVERLAY_ATTR = "data-board-overlay";

/**
 * 3D 판 영역. 같은 부모 안에서 `data-board-overlay` 가 붙은 요소 중 판 영역에 겹친 것들의 자리를 재고,
 * 고정 카메라는 그 자리를 피해 판 전체(테두리와 컵 포함)가 들어오도록 맞춘다.
 */
export function Board3D() {
  const ref = useRef<HTMLDivElement>(null);
  const reserve = useOverlayReserve(ref);
  return (
    <div className="board" ref={ref}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ manual: true }}
        aria-label="주사위 판"
        role="img"
      >
        <color attach="background" args={["#1b120d"]} />
        <CameraRig reserve={reserve} />
        <hemisphereLight args={["#ffe7c4", "#2a0d08", 0.9]} />
        <directionalLight
          position={[-2, 10, 4]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <BoardMesh />
        <PresenterSlot />
      </Canvas>
    </div>
  );
}

/** 고정 카메라. 사용자가 시점을 돌릴 수 없다. 판 영역 크기나 겹친 표시가 바뀔 때만 다시 맞춘다. */
function CameraRig({ reserve }: { reserve: OverlayReserve }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    applyFit(camera, fitCamera({ width: size.width, height: size.height, ...reserve }));
    invalidate();
  }, [camera, size.width, size.height, reserve, invalidate]);
  return null;
}

/** 저장소의 굴림 결과·홀드 상태·열을 연출 입구에 넘기고, 입구가 알리는 두 시점을 저장소에 돌려준다. */
function PresenterSlot() {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const rollId = useGame((s) => s.rollId);
  const gameDice = useGame((s) => s.game.dice);
  const columns = useGame((s) => s.columns);
  const onStopped = useGame((s) => s.presenterStopped);
  const onLinedUp = useGame((s) => s.presenterLinedUp);
  const dice = useMemo<PresentedDie[]>(
    () => gameDice.map((die) => ({ ...die, column: columns[die.id] ?? die.id })),
    [gameDice, columns],
  );
  const Presenter = choosePresenter(reducedMotion, PRESENTERS);
  return <Presenter rollId={rollId} dice={dice} onStopped={onStopped} onLinedUp={onLinedUp} />;
}

function useOverlayReserve(ref: RefObject<HTMLDivElement | null>): OverlayReserve {
  const [reserve, setReserve] = useState<OverlayReserve>({ reserveTop: 0, avoid: [] });
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const root = container.parentElement ?? container;
    const overlays = () => [...root.querySelectorAll(`[${OVERLAY_ATTR}]`)];
    const measure = () => {
      const base = container.getBoundingClientRect();
      // 판 영역과 겹치는 부분만 남긴다. 판 밖에 놓인 것(가로 배치의 버튼)은 크기 0 이 되어 빠진다.
      const rects: Rect[] = overlays().map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: Math.max(r.left, base.left) - base.left,
          top: Math.max(r.top, base.top) - base.top,
          right: Math.min(r.right, base.right) - base.left,
          bottom: Math.min(r.bottom, base.bottom) - base.top,
        };
      });
      const next = overlayReserve(rects);
      setReserve((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const el of overlays()) observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return reserve;
}
