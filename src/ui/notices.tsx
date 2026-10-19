import { useCallback, useEffect, useState } from "react";
import type { BonusNotice } from "../engine/totals";
import type { Category } from "../engine/types";
import { useGame } from "../store/store-context";
import { CATEGORY_NAMES } from "./category-names";
import { Confetti } from "./confetti";

/** 성립 알림이 떠 있는 시간(ms). 원작은 1~1.5초. */
export const CALLOUT_MS = 1300;

/** 보너스 알림 한 단계의 시간(ms). "+35" 는 「보너스!」→「+35」 두 단계, "+0" 은 두 단계 시간 내내 「+0」 하나. */
export const BONUS_STEP_MS = 1000;

/**
 * 성립 알림(스펙 「굴림 연출」의 성립 알림). 굴림의 정렬 끝에 판 위쪽 가운데에 카테고리 이름을 크게 띄웠다가
 * 줄이고, CALLOUT_MS 뒤 사라진다. 조작을 막지 않는다. 요트면 색종이도 터진다.
 * 판 위에 겹치지만 카메라 맞춤이 피할 자리가 아니라서 data-board-overlay 를 붙이지 않는다.
 */
export function ComboCallout() {
  const callout = useGame((s) => s.callout);
  return (
    <>
      {callout && (
        <CalloutText key={callout.rollId} rollId={callout.rollId} category={callout.category} />
      )}
      <YachtConfetti />
    </>
  );
}

function CalloutText({ rollId, category }: { rollId: number; category: Category }) {
  const ended = useGame((s) => s.calloutEnded);
  useEffect(() => {
    const timer = setTimeout(() => ended(rollId), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [rollId, ended]);
  return (
    <div className={`notice callout-text${category === "yacht" ? " yacht" : ""}`} role="status">
      {CATEGORY_NAMES[category]}
    </div>
  );
}

/** 요트 성립 알림의 색종이. 알림 글자가 사라진 뒤에도 다 떨어질 때까지 둔다. */
function YachtConfetti() {
  const callout = useGame((s) => s.callout);
  const [burst, setBurst] = useState<number | null>(null);
  useEffect(() => {
    if (callout?.category === "yacht") setBurst(callout.rollId);
  }, [callout]);
  const done = useCallback(() => setBurst(null), []);
  return burst === null ? null : <Confetti key={burst} onDone={done} />;
}

/**
 * 보너스 알림(스펙 「보너스 알림」). 판 가운데에 「보너스!」→「+35」, 또는 「+0」을 약 2초 띄운다.
 * 끝나면 저장소에 알려(`bonusNoticeEnded`) 화면의 차례 넘김이 일어난다. 그동안 굴림 버튼은 잠긴다.
 */
export function BonusNoticeView() {
  const bonusNotice = useGame((s) => s.bonusNotice);
  if (!bonusNotice) return null;
  return <BonusText key={bonusNotice.id} id={bonusNotice.id} notice={bonusNotice.notice} />;
}

/**
 * 알림에 차례로 띄울 글자와 각각 떠 있는 시간(ms). 합은 언제나 BONUS_STEP_MS * 2 다.
 * 글자마다 나타났다 사라지는 연출을 그 시간에 맞춰, 알림이 끝나기 전에 글자가 사라지지 않게 한다.
 */
const BONUS_STEPS: Record<BonusNotice, readonly (readonly [string, number])[]> = {
  "+35": [
    ["보너스!", BONUS_STEP_MS],
    ["+35", BONUS_STEP_MS],
  ],
  "+0": [["+0", BONUS_STEP_MS * 2]],
};

function BonusText({ id, notice }: { id: number; notice: BonusNotice }) {
  const ended = useGame((s) => s.bonusNoticeEnded);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const steps = BONUS_STEPS[notice];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    steps.forEach(([, ms], i) => {
      at += ms;
      timers.push(setTimeout(() => (i + 1 < steps.length ? setStep(i + 1) : ended(id)), at));
    });
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [id, notice, ended]);
  const [text, ms] = BONUS_STEPS[notice][step] ?? ["", 0];
  // 단계가 바뀌면 key 로 새로 붙여 연출을 처음부터 다시 한다. '동작 줄이기'면 CSS 가 연출을 끈다.
  return (
    <div className="notice bonus-text" role="status">
      <span key={step} style={{ animationDuration: `${ms}ms` }}>
        {text}
      </span>
    </div>
  );
}
