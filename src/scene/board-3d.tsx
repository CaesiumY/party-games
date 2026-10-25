import { Canvas, useThree } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import { calloutAnchor } from "../layout/callout";
import { applyFit, type CameraFit, fitCamera, type Rect } from "../layout/camera-fit";
import { useDiceSlots, useGame } from "../store/store-context";
import { BoardMesh } from "./board-mesh";
import { choosePresenter } from "./choose-presenter";
import { ContributingGlow } from "./contributing-glow";
import { DieHitTargets } from "./die-hit-targets";
import { HoldBubbles } from "./hold-bubbles";
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
  const { width, height, reserveTop, avoid } = useBoardArea(ref);
  // 카메라와 홀드 말풍선이 같은 맞춤 값을 쓴다. 말풍선 자리는 이 값으로 투영해 정한다.
  const fit = useMemo(
    () => (width && height ? fitCamera({ width, height, reserveTop, avoid }) : null),
    [width, height, reserveTop, avoid],
  );
  useCalloutAnchor(ref, fit, reserveTop);
  return (
    <div className="board" ref={ref}>
      <Canvas
        shadows="percentage"
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ manual: true }}
        aria-label="주사위 판"
        role="img"
      >
        {fit && <CameraRig fit={fit} />}
        <SceneLights />
        <BoardMesh />
        <PresenterSlot />
        <ContributingGlow />
        <DieHitTargets />
      </Canvas>
      {fit && <HoldBubbles fit={fit} topLimit={reserveTop} />}
    </div>
  );
}

/**
 * 성립 알림(src/ui/notices.tsx)은 판 영역과 같은 칸에 겹치는 형제 요소라서, 판이 실제로 그려진 자리를 모른다.
 * 카메라 맞춤으로 투영한 자리(홀드 자리 줄 바로 아래의 펠트, src/layout/callout.ts)를 부모의 CSS 변수
 * `--callout-x`·`--callout-y`(판 영역 왼쪽 위 기준 px)와 쓸 수 있는 높이 `--callout-max-h` 로 알려 준다.
 */
function useCalloutAnchor(
  ref: RefObject<HTMLDivElement | null>,
  fit: CameraFit | null,
  reserveTop: number,
) {
  useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (!root || !fit) return;
    const { x, y, maxHeight } = calloutAnchor(fit, reserveTop);
    root.style.setProperty("--callout-x", `${x}px`);
    root.style.setProperty("--callout-y", `${y}px`);
    root.style.setProperty("--callout-max-h", `${maxHeight}px`);
    return () => {
      root.style.removeProperty("--callout-x");
      root.style.removeProperty("--callout-y");
      root.style.removeProperty("--callout-max-h");
    };
  }, [ref, fit, reserveTop]);
}

/**
 * 조명(카지노 펠트 룩): 따뜻한 하늘빛 약하게 + 판 위 왼쪽 앞에서 비추는 스포트라이트 하나.
 * 스포트라이트 가장자리가 판 바깥으로 갈수록 어두워져 테이블 조명 느낌을 낸다.
 * 그림자는 이 조명 하나만 만들고 그림자 지도는 1024² 로 둔다(중급 휴대폰 부담을 줄이려고).
 */
function SceneLights() {
  return (
    <>
      <hemisphereLight args={["#ffe7c4", "#2a0d08", 0.55]} />
      <spotLight
        color="#fff1d8"
        position={[-1.5, 11, 3]}
        intensity={220}
        distance={30}
        angle={0.62}
        penumbra={0.55}
        decay={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
    </>
  );
}

/** 고정 카메라. 사용자가 시점을 돌릴 수 없다. 판 영역 크기나 겹친 표시가 바뀔 때만 다시 맞춘다. */
function CameraRig({ fit }: { fit: CameraFit }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // size 는 캔버스가 크기를 바꾼 뒤 다시 맞추려고 넣는다(R3F 가 크기를 바꿀 때 aspect 를 덮어쓴다).
  useLayoutEffect(() => {
    if (!size.width || !size.height) return;
    applyFit(camera, fit);
    invalidate();
  }, [camera, fit, size.width, size.height, invalidate]);
  return null;
}

/**
 * 저장소의 굴림 결과·홀드 상태·열을 연출 입구에 넘기고, 입구가 알리는 시점(멈춤·정렬 끝·다 옮김)을
 * 저장소에 돌려준다.
 * `held` 는 그 주사위가 홀드 자리에 놓이는지다. 굴림 연출 동안은 엔진의 홀드 그대로이고,
 * 3번째 굴림의 정렬 끝 뒤에는(굴림이 아닌 갱신으로) 다섯 개 모두 홀드 자리가 된다.
 */
function PresenterSlot() {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const rollId = useGame((s) => s.rollId);
  const gameDice = useGame((s) => s.game.dice);
  const slots = useDiceSlots();
  const onStopped = useGame((s) => s.presenterStopped);
  const onLinedUp = useGame((s) => s.presenterLinedUp);
  const onDieSettled = useGame((s) => s.presenterDieSettled);
  const dice = useMemo<PresentedDie[]>(
    () =>
      gameDice.map((die) => {
        const slot = slots[die.id];
        return { ...die, held: slot?.row === "hold", column: slot?.column ?? die.id };
      }),
    [gameDice, slots],
  );
  const Presenter = choosePresenter(reducedMotion, PRESENTERS);
  return (
    <Presenter
      rollId={rollId}
      dice={dice}
      onStopped={onStopped}
      onLinedUp={onLinedUp}
      onDieSettled={onDieSettled}
    />
  );
}

interface BoardArea extends OverlayReserve {
  /** 판 영역 크기(px). */
  width: number;
  height: number;
}

/** 판 영역의 크기와, 그 위에 겹친 표시들이 차지한 자리. */
function useBoardArea(ref: RefObject<HTMLDivElement | null>): BoardArea {
  const [area, setArea] = useState<BoardArea>({ width: 0, height: 0, reserveTop: 0, avoid: [] });
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
      const next = { width: base.width, height: base.height, ...overlayReserve(rects) };
      setArea((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
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
  return area;
}
