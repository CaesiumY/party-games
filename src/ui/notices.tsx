import { useCallback, useEffect, useState } from "react";
import type { BonusNotice } from "../engine/totals";
import type { Category } from "../engine/types";
import { useGame } from "../store/store-context";
import { CATEGORY_NAMES } from "./category-names";
import { Confetti } from "./confetti";

/** 성립 알림이 떠 있는 시간(ms). 원작은 1~1.5초. */
export const CALLOUT_MS = 1300;

/** 보너스 알림 한 단계의 시간(ms). "+35" 는 「보너스!」→「+35」 두 단계, "+0" 은 두 단계 시간 동안 「+0」. */
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

function BonusText({ id, notice }: { id: number; notice: BonusNotice }) {
  const ended = useGame((s) => s.bonusNoticeEnded);
  const [step, setStep] = useState(notice === "+35" ? 0 : 1);
  useEffect(() => {
    const next = setTimeout(() => setStep(1), BONUS_STEP_MS);
    const end = setTimeout(() => ended(id), BONUS_STEP_MS * 2);
    return () => {
      clearTimeout(next);
      clearTimeout(end);
    };
  }, [id, ended]);
  return (
    <div className="notice bonus-text" role="status">
      <span key={step}>{step === 0 ? "보너스!" : notice}</span>
    </div>
  );
}
