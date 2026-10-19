# src 구조 — 무엇을 어디에 두나

요트 앱의 코드는 다섯 칸으로 나뉜다. 위 칸일수록 아래 칸을 모른다(엔진은 아무것도 모르고, 화면은 저장소를 통해서만 엔진을 쓴다). 새 기능은 되도록 **기존 파일을 고치기보다 파일을 더해서** 넣는다.

| 폴더 | 하는 일 | 기대도 되는 것 |
|---|---|---|
| `engine/` | 게임 엔진. 점수 규칙과 턴 진행. 순수 TypeScript | 엔진 안의 파일만 (`boundary.test.ts` 가 검사) |
| `store/` | zustand 상태 저장소. 엔진을 화면에 잇고, **조작 가능 여부를 한 곳에서 판정**. 지금 보이는 화면(시작/게임)과 브라우저 저장도 여기 | engine, layout |
| `layout/` | 화면 표현을 정하는 순수 계산. 열 규칙, 주사위 자리, 카메라 거리 맞춤 | engine 의 타입, three.js 의 수학(WebGL·DOM 없이) |
| `scene/` | 3D 장면(React Three Fiber). 판, 주사위, **굴림 연출 입구** | store, layout |
| `ui/` | 2D 화면. 시작 화면, 점수표, 버튼, 판 위 겹침 표시, 결과 화면, WebGL 미지원 안내 | store, engine 의 조회 함수 |
| `a11y/` | 접근성. '동작 줄이기' 감지, 보이지 않는 주사위 버튼 | store, layout |

`main.tsx` 는 시작점(주사위 공급원·저장소·브라우저 저장 항목을 만들고 설정을 잇는다), `app.tsx` 는 WebGL 유무와 저장소의 `screen` 으로 화면(시작 → 게임 → 결과)을 고른다.

## 이음매 (다른 티켓이 끼우는 자리)

- **엔진 명령의 거부 방식**: 모든 명령은 예외를 던지지 않고 `{ ok: true, state }` 또는 `{ ok: false, reason }` 을 돌려준다(`engine/types.ts` 의 `CommandResult`). 거부 이유를 더할 때는 `Rejection` 에 더한다. 규칙 판정은 `rollRejection`·`recordRejection` 처럼 "안 되는 이유 | null" 함수로 따로 내보내, 저장소가 같은 판정을 다시 쓰게 한다.
- **주사위 공급원**: `engine/dice-source.ts` 의 `DiceSource` (플레이어, 턴, 굴림 번호, 굴릴 개수 → 눈). 운영은 `crypto-dice-source.ts`, 단위 테스트는 `scriptedDiceSource`. E2E 공급원(#15)은 새 파일로 더한다.
- **점수 계산**: `engine/scoring.ts` 의 표 하나(12개 카테고리, 성립하지 않으면 0). 미리보기와 기록은 같은 조회 `scorePreview`(`engine/game.ts`)를 쓴다. 윗칸 보너스와 총합 득점은 `engine/totals.ts`.
- **조작 잠금 판정**: `store/permissions.ts` 가 유일한 자리. 버튼 활성·저장소 명령이 모두 이것을 쓴다. 홀드·플레이 방법("?") 잠금도 여기에 더한다.
- **굴림 연출 입구**: `scene/roll-presenter.ts` 의 `RollPresenter` — `{ rollId, dice: {id, value, held, column}[], onStopped(rollId), onLinedUp(rollId) }` 를 받는 R3F 컴포넌트. 굴림 결과는 굴림 버튼을 누를 때 이미 정해져 있다(ADR-0001). 구현은 `scene/presenters/` 에 파일로 더하고 `presenters/index.ts` 의 `animated` 만 바꾼다(#5). '동작 줄이기'가 켜져 있으면 `choosePresenter` 가 언제나 `instant`(순간 배치)를 고른다. 물리 연출은 `presenters/physics-presenter.tsx` 이고, 미리 굴리기·면 맞추기·궤적 재생은 React 없는 순수 모듈로 `presenters/physics/` 에 있다(node 에서 테스트).
- **열 규칙**: `layout/columns.ts`. 굴림이 끝날 때만 `lineupColumns(dice, { finalRoll })` 로 열을 다시 받고, 홀드 토글은 열을 바꾸지 않는다. 주사위가 놓이는 자리(열·줄)는 저장소의 `slots()`(화면은 `useDiceSlots()`)가 정하며, 3번째 굴림의 정렬 끝 뒤에는 다섯 개 모두 홀드 자리다(표현일 뿐 엔진의 홀드는 그대로). 보이지 않는 주사위 버튼의 순서는 `screenOrder(slots)`.
- **홀드**: 엔진 `toggleHold(state, die)`·`holdRejection`, 저장소 `toggleHold(die)`. 3D 탭(`scene/die-hit-targets.tsx`), 홀드 말풍선(`scene/hold-bubbles.tsx`, 자리 계산은 `layout/hold-bubbles.ts`), 보이지 않는 주사위 버튼(`a11y/dice-buttons.tsx`)이 모두 같은 저장소 명령을 쓴다. 말풍선 자리는 카메라 맞춤 값과 그 주사위의 열·줄로만 정해져, 다른 주사위를 홀드해도 움직이지 않는다.
- **카메라 맞춤**: `layout/camera-fit.ts` 의 `fitCamera({ width, height, reserveTop, avoid })`. 판 위에 겹치는 요소에 `data-board-overlay` 를 붙이면 `scene/board-3d.tsx` 가 자리를 재서 넣는다. 맨 위에 붙은 것은 판을 아래로 내려 피하고, 나머지(세로 배치의 버튼 등)는 컵·정렬 줄이 겹치지 않게 피한다.
- **게임 끝**: 모든 점수표가 차면 엔진이 `finished` 를 켜고, 그 뒤 명령은 모두 `"game-over"` 로 거부한다. 모드는 저장하지 않고 `gameMode(state)`(플레이어 수)로 계산한다.
- **화면 전환**: 저장소의 `screen`(`"start" | "game"`)과 명령 `newGame(players)`·`restart()`(같은 멤버로 다시)·`goHome()`(처음으로). 결과 화면을 띄울지는 `resultVisible`(`store/game-store.ts`) 한 곳에서 정한다(게임이 끝났고 보너스 알림이 없을 때).
- **브라우저 저장 도우미**: `store/stored-value.ts` 의 `createStoredValue({ storage, key, version, parse })` → `{ read, write, clear }`. 저장 항목(키)마다 버전을 두고, 읽을 수 없거나 버전이 다르거나 `parse` 가 null 을 돌려주면 그 키만 지운다. 저장소 접근이 막혀도 예외를 던지지 않는다. 운영은 `browserStorage()`, 테스트는 `memoryStorage()`. 이어 하기(#10)·음소거(#12)는 `best-score.ts` 처럼 항목 파일을 하나 더하고 `main.tsx` 에서 저장소에 넣는다.
- **최고 점수**: `store/best-score.ts` 의 `bestScoreValue(storage)`(키 `yacht.best-score`). 연습 모드 판이 끝나는 기록에서 저장소가 지난 최고 점수와 견주어(`settleBest`) 넘었을 때만 쓰고, 결과는 `outcome` 에 둔다.
- **화면 배치**: `ui/app.css` 의 `@media (orientation: portrait | landscape)`. 정사각형은 세로 배치다.
- **기여 주사위**: 점수 계산 표(`engine/scoring.ts`)가 점수와 함께 기여 주사위도 낸다(`contributingFor`). 엔진 조회는 `contributingDice(state, category)`, 화면은 `useContributingDice()`(선택한 카테고리 기준). 3D 빛은 `scene/contributing-glow.tsx` 가 정렬 줄·홀드 자리의 열 위치에 겹쳐 그려서, 연출 구현(#5·#11)은 몰라도 된다.
- **성립 알림**: 엔진 `comboCallout(state)` 가 띄울 카테고리를 정하고, 저장소가 정렬 끝(`presenterLinedUp`)에 `callout` 으로 들고 있다가 `calloutEnded(rollId)`·다시 굴림·기록에 지운다. 화면은 `ui/notices.tsx`.
- **색종이**: `ui/confetti.tsx` 의 `<Confetti onDone? />`. 붙이면 한 번 터지고, 다시 터뜨리려면 `key` 를 바꾼다. '동작 줄이기'면 스스로 아무것도 그리지 않으므로 쓰는 쪽이 따로 막지 않아도 된다(결과 화면 #9 도 그대로 쓴다).
- **차례 넘김 미루기(보너스 알림)**: 엔진은 기록과 함께 바로 다음 차례로 넘어간다(저장·복원도 그 상태). 기록이 보너스 알림(엔진 `bonusNotice(before, after)`: "+35"/"+0")을 낳으면 저장소가 `bonusNotice` 를 들고, 그동안 화면의 지금 차례는 방금 기록한 플레이어다(`shownPlayer()`, 화면은 `useShownPlayer()`). 굴림과 "?"(`canOpenHelp`)는 잠긴다. 알림 표시가 끝나면(`bonusNoticeEnded(id)`) `bonusNotice` 가 지워지고 `shownPlayer` 가 엔진의 지금 차례로 바뀐다 — **이 순간이 화면의 차례 넘김**이다. 결과 화면은 게임이 끝났고 `bonusNotice` 가 없을 때 띄운다.
- **차례 배너**: 대전 모드에서 화면의 차례가 넘어가는 순간(기록 뒤, 보너스 알림이 있으면 `bonusNoticeEnded` 때) 저장소가 `turnBanner`(`{ id, player }`)를 들고, `ui/turn-banner.tsx` 가 「다음은 ○○ 차례」를 띄웠다가 `turnBannerEnded(id)` 로 지운다. 게임이 끝난 기록이나 연습 모드에는 없다. 조작은 막지 않고 "?"(`helpBlocker`)만 막는다.
- **순위**: 엔진 `ranking(state)`(`engine/ranking.ts`) → `{ player, total, rank }[]`, 총합 득점 순서. 동점이면 같은 순위이고 다음 순위는 그 인원만큼 건너뛴다(1·1·3). 결과 화면(`ui/result-screen.tsx`)은 대전 모드면 순위 표 → 「다음」 → 승자 화면(공동 1등 모두, 색종이), 연습 모드면 최고 점수 비교다.
- **플레이어 이름과 색**: 시작 화면이 인원(1~4)과 이름을 받고 `playerNames(inputs)`(`ui/player-names.ts`: 앞뒤 공백 제거, 비면 「플레이어 n」, 같은 이름이면 뒤에 " 2")로 `newGame` 에 넘긴다. 플레이어 색은 저장하지 않고 자리 순번으로 정한다(`ui/player-dot.tsx` 의 `playerColor(i)`·`<PlayerDot player />`). 그래서 「같은 멤버로 다시」는 이름 순서만 지키면 색도 그대로다.

## 테스트

- `pnpm test` — Vitest. 엔진·저장소·배치 계산은 node 환경, 화면 테스트(`*.test.tsx`)만 파일 첫 줄에 `// @vitest-environment jsdom` 을 적는다. 3D 캔버스는 테스트에서 그리지 않는다(`App` 의 `Board` 자리에 대역을 넣는다).
- `pnpm typecheck`, `pnpm check`(Biome), `pnpm build`.
