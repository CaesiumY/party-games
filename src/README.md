# src 구조 — 무엇을 어디에 두나

요트 앱의 코드는 다섯 칸으로 나뉜다. 위 칸일수록 아래 칸을 모른다(엔진은 아무것도 모르고, 화면은 저장소를 통해서만 엔진을 쓴다). 새 기능은 되도록 **기존 파일을 고치기보다 파일을 더해서** 넣는다.

| 폴더 | 하는 일 | 기대도 되는 것 |
|---|---|---|
| `engine/` | 게임 엔진. 점수 규칙과 턴 진행. 순수 TypeScript | 엔진 안의 파일만 (`boundary.test.ts` 가 검사) |
| `store/` | zustand 상태 저장소. 엔진을 화면에 잇고, **조작 가능 여부를 한 곳에서 판정** | engine, layout |
| `layout/` | 화면 표현을 정하는 순수 계산. 열 규칙, 주사위 자리, 카메라 거리 맞춤 | engine 의 타입, three.js 의 수학(WebGL·DOM 없이) |
| `scene/` | 3D 장면(React Three Fiber). 판, 주사위, **굴림 연출 입구** | store, layout |
| `ui/` | 2D 화면. 점수표, 버튼, 판 위 겹침 표시, WebGL 미지원 안내 | store, engine 의 조회 함수 |
| `a11y/` | 접근성 설정. '동작 줄이기' 감지 (보이지 않는 주사위 버튼은 #7 이 여기에 더한다) | store |

`main.tsx` 는 시작점(주사위 공급원·저장소를 만들고 설정을 잇는다), `app.tsx` 는 WebGL 유무로 화면을 고른다.

## 이음매 (다른 티켓이 끼우는 자리)

- **엔진 명령의 거부 방식**: 모든 명령은 예외를 던지지 않고 `{ ok: true, state }` 또는 `{ ok: false, reason }` 을 돌려준다(`engine/types.ts` 의 `CommandResult`). 거부 이유를 더할 때는 `Rejection` 에 더한다. 규칙 판정은 `rollRejection`·`recordRejection` 처럼 "안 되는 이유 | null" 함수로 따로 내보내, 저장소가 같은 판정을 다시 쓰게 한다.
- **주사위 공급원**: `engine/dice-source.ts` 의 `DiceSource` (플레이어, 턴, 굴림 번호, 굴릴 개수 → 눈). 운영은 `crypto-dice-source.ts`, 단위 테스트는 `scriptedDiceSource`. E2E 공급원(#15)은 새 파일로 더한다.
- **점수 계산**: `engine/scoring.ts` 의 표 하나(12개 카테고리, 성립하지 않으면 0). 미리보기와 기록은 같은 조회 `scorePreview`(`engine/game.ts`)를 쓴다. 윗칸 보너스와 총합 득점은 `engine/totals.ts`.
- **조작 잠금 판정**: `store/permissions.ts` 가 유일한 자리. 버튼 활성·저장소 명령이 모두 이것을 쓴다. 홀드·플레이 방법("?") 잠금도 여기에 더한다.
- **굴림 연출 입구**: `scene/roll-presenter.ts` 의 `RollPresenter` — `{ rollId, dice: {id, value, held, column}[], onStopped(rollId), onLinedUp(rollId) }` 를 받는 R3F 컴포넌트. 굴림 결과는 굴림 버튼을 누를 때 이미 정해져 있다(ADR-0001). 구현은 `scene/presenters/` 에 파일로 더하고 `presenters/index.ts` 의 `animated` 만 바꾼다(#5). '동작 줄이기'가 켜져 있으면 `choosePresenter` 가 언제나 `instant`(순간 배치)를 고른다. 물리 연출은 `presenters/physics-presenter.tsx` 이고, 미리 굴리기·면 맞추기·궤적 재생은 React 없는 순수 모듈로 `presenters/physics/` 에 있다(node 에서 테스트).
- **열 규칙**: `layout/columns.ts`. 지금은 다섯 개를 오름차순으로만 놓는다(#7 이 홀드 규칙을 더한다).
- **카메라 맞춤**: `layout/camera-fit.ts` 의 `fitCamera({ width, height, reserveTop, avoid })`. 판 위에 겹치는 요소에 `data-board-overlay` 를 붙이면 `scene/board-3d.tsx` 가 자리를 재서 넣는다. 맨 위에 붙은 것은 판을 아래로 내려 피하고, 나머지(세로 배치의 버튼 등)는 컵·정렬 줄이 겹치지 않게 피한다.
- **화면 배치**: `ui/app.css` 의 `@media (orientation: portrait | landscape)`. 정사각형은 세로 배치다.

## 테스트

- `pnpm test` — Vitest. 엔진·저장소·배치 계산은 node 환경, 화면 테스트(`*.test.tsx`)만 파일 첫 줄에 `// @vitest-environment jsdom` 을 적는다. 3D 캔버스는 테스트에서 그리지 않는다(`App` 의 `Board` 자리에 대역을 넣는다).
- `pnpm typecheck`, `pnpm check`(Biome), `pnpm build`.
- 임시: 시작 화면(#8)이 오기 전까지 `?players=1..4` 로 인원을 바꿔 화면 배치를 확인한다.
