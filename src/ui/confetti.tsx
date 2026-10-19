import { type CSSProperties, useEffect, useMemo } from "react";
import { usePrefersReducedMotion } from "../a11y/use-reduced-motion";

/** 색종이 색. 원작처럼 밝은 원색을 섞는다. */
const COLORS = ["#fee267", "#ff7a3d", "#ff6fb1", "#39c3f2", "#1fa45b", "#8b4dff", "#ffffff"];

export interface ConfettiProps {
  /** 색종이 조각 수. */
  pieces?: number;
  /** 다 떨어질 때까지의 시간(ms). 이 시간이 지나면 `onDone` 을 부른다. */
  duration?: number;
  onDone?(): void;
}

interface Piece {
  style: CSSProperties;
}

function makePieces(count: number, duration: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const fall = duration * (0.65 + Math.random() * 0.35);
    const delay = Math.random() * (duration - fall);
    return {
      style: {
        "--x": `${Math.random() * 100}%`,
        "--dx": `${(Math.random() - 0.5) * 40}vw`,
        "--r": `${(Math.random() - 0.5) * 1440}deg`,
        "--w": `${7 + Math.random() * 7}px`,
        "--c": COLORS[i % COLORS.length],
        "--t": `${fall}ms`,
        "--d": `${delay}ms`,
      } as CSSProperties,
    };
  });
}

/**
 * 색종이 한 번 터뜨리기. 화면 전체 위에 겹치고 조작을 막지 않는다. 다시 터뜨리려면 `key` 를 바꿔 새로 붙인다.
 * 성립 알림의 요트와 결과 화면의 승자 표시(#9)가 쓴다.
 * '동작 줄이기'가 켜져 있으면 아무것도 그리지 않는다(스펙: 색종이는 어느 화면에서도 띄우지 않는다).
 */
export function Confetti({ pieces = 120, duration = 2600, onDone }: ConfettiProps) {
  const reduced = usePrefersReducedMotion();
  const list = useMemo(() => makePieces(pieces, duration), [pieces, duration]);
  useEffect(() => {
    if (!onDone) return;
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);
  if (reduced) return null;
  return (
    <div className="confetti" aria-hidden="true" data-testid="confetti">
      {list.map((piece, i) => (
        // 조각은 순서만 있는 장식이라 순번을 키로 쓴다.
        // biome-ignore lint/suspicious/noArrayIndexKey: 조각 목록은 처음 한 번만 만들고 바뀌지 않는다.
        <i key={i} style={piece.style} />
      ))}
    </div>
  );
}
