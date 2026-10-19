import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ruleExamples } from "../engine/rule-examples";
import { CATEGORIES } from "../engine/types";
import { CATEGORY_NAMES } from "./category-names";
import {
  BONUS_TEXT,
  HINT_SECTIONS,
  PLAY_SECTIONS,
  RULE_TEXT,
  type Section,
} from "./how-to-play-content";

/**
 * 플레이 방법을 여는 버튼과, 연 동안의 모달 대화상자(스펙 「플레이 방법 화면」).
 * 시작 화면의 "플레이 방법" 버튼과 점수표 머리의 "?" 버튼이 쓴다. 접근 이름은 둘 다 "플레이 방법"이다.
 * 열고 닫기는 화면 상태일 뿐이라 저장소의 게임 상태를 건드리지 않는다. "?" 의 잠금은 부르는 쪽이
 * `canOpenHelp`(src/store/permissions.ts)로 `disabled` 를 준다.
 */
export function HowToPlayButton({
  children,
  className,
  disabled = false,
}: {
  /** 버튼에 보이는 글자. 접근 이름과 다르면(예: "?") 접근 이름 "플레이 방법"을 따로 붙인다. */
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // 닫으면 연 버튼으로 포커스를 돌린다. 대화상자의 정리(close)가 먼저 돌아 아래 화면이 다시 살아난 뒤다.
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={className}
        aria-label={children === "플레이 방법" ? undefined : "플레이 방법"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && createPortal(<HowToPlayDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

type Tab = "play" | "rules" | "hints";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "play", label: "플레이 방법" },
  { id: "rules", label: "족보" },
  { id: "hints", label: "힌트" },
];

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * 제목이 "플레이 방법"인 모달 대화상자. 브라우저의 `showModal` 로 띄워 아래 화면을 화면 낭독기와
 * 키보드에서 뺀다. 포커스는 대화상자 안에서만 돌고, 닫기 버튼이나 Esc 로 닫는다.
 * 내용이 길면 탭 내용 영역만 스크롤한다.
 */
function HowToPlayDialog({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>("play");
  const id = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // jsdom 처럼 showModal 이 없는 환경에서는 열린 표시만 한다.
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else dialog.setAttribute("open", "");
    closeButton.current?.focus();
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    // 마지막에서 Tab 이면 처음으로, 처음에서 Shift+Tab 이면 마지막으로 돈다.
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = TABS.findIndex((t) => t.id === tab);
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let next: number | undefined;
    if (event.key in step) next = (at + (step[event.key] ?? 0) + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    const target = next === undefined ? undefined : TABS[next];
    if (!target) return;
    event.preventDefault();
    setTab(target.id);
    document.getElementById(`${id}-tab-${target.id}`)?.focus();
  };

  return (
    <dialog
      ref={ref}
      className="how-to-play"
      aria-labelledby={`${id}-title`}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="how-to-play-head">
        <h2 id={`${id}-title`}>플레이 방법</h2>
        <button ref={closeButton} type="button" className="close" onClick={onClose}>
          닫기
        </button>
      </header>
      <div role="tablist" aria-label="플레이 방법" className="how-to-play-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        className="how-to-play-body"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 스크롤하는 영역이라 키보드로도 스크롤할 수 있게 포커스를 받는다
        tabIndex={0}
      >
        {tab === "play" && <Sections sections={PLAY_SECTIONS} />}
        {tab === "rules" && <Rules />}
        {tab === "hints" && <Sections sections={HINT_SECTIONS} />}
      </div>
    </dialog>
  );
}

function Sections({ sections }: { sections: readonly Section[] }) {
  return sections.map((section) => (
    <section key={section.title}>
      <h3>{section.title}</h3>
      {section.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </section>
  ));
}

/** 족보 탭: 점수표 순서로 12개 카테고리, 끝에 윗칸 보너스. 예시 점수는 엔진이 셈한다. */
function Rules() {
  const examples = ruleExamples();
  return (
    <ul className="rules">
      {CATEGORIES.map((category) => {
        const text = RULE_TEXT[category];
        return (
          <li key={category}>
            <h3>{CATEGORY_NAMES[category]}</h3>
            <p>{text.description}</p>
            {text.note && <p className="note">{text.note}</p>}
            <p className="examples">
              {examples
                .filter((example) => example.category === category)
                .map((example) => (
                  <span
                    key={example.dice.join("")}
                    className="example"
                    role="img"
                    aria-label={`주사위 ${example.dice.join(" ")}, ${example.score}점`}
                  >
                    {example.dice.map((value, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: 같은 눈이 여러 번 나와 순번이 자리다
                      <span key={i} className="die-face">
                        {value}
                      </span>
                    ))}
                    <span className="score">{example.score}점</span>
                  </span>
                ))}
            </p>
          </li>
        );
      })}
      <li className="bonus">
        <h3>{BONUS_TEXT.name}</h3>
        <p>{BONUS_TEXT.description}</p>
      </li>
    </ul>
  );
}
