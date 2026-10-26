import { expect, type Locator, type Page, test } from "@playwright/test";
import { E2E_DICE_SOURCE_MARKER } from "../src/engine/e2e-dice-source";

// 앱 전체 E2E(스펙 Testing Decisions 「테스트 지점 ②」, #15). 로컬에서 `pnpm e2e` 로 돈다.
// 눈은 테스트용 주사위 공급원(src/engine/e2e-dice-source.ts)이 (플레이어, 턴, 굴림 번호)로 정한다.
// 아래 기대 점수는 그 표에서 손으로 셈한 값이다.

/** 점수표 순서의 카테고리 이름(용어집 표기). 두 플레이어 모두 턴 n 에 n 번째 카테고리에 기록한다. */
const CATEGORY_NAMES = [
  "에이스",
  "듀스",
  "트레이",
  "포",
  "파이브",
  "식스",
  "초이스",
  "포 다이스",
  "풀 하우스",
  "S. 스트레이트",
  "L. 스트레이트",
  "요트",
] as const;

const PLAYERS = ["가영", "나래"] as const;

/** 턴마다 기록되는 점수. [플레이어][턴 - 1]. */
const EXPECTED_SCORES = [
  [3, 6, 9, 12, 15, 18, 26, 18, 19, 15, 30, 50],
  [2, 4, 6, 8, 10, 12, 15, 0, 13, 15, 30, 0],
] as const;
/** 가영: 윗칸 63 + 보너스 35 + 아랫칸 158. 나래: 윗칸 42(보너스 없음) + 아랫칸 73. */
const EXPECTED_TOTALS = [256, 115] as const;

/** 스펙 「화면 배치」의 확인 크기 네 곳. */
const CHECK_SIZES = [
  { name: "휴대폰 세로", width: 375, height: 667 },
  { name: "휴대폰 가로", width: 667, height: 375 },
  { name: "태블릿 가로", width: 1024, height: 768 },
  { name: "데스크톱", width: 1280, height: 720 },
] as const;

/** 누르는 영역의 최소 크기(px, WCAG 2.2). */
const MIN_TARGET = 24;

const scorecard = (page: Page) => page.getByRole("region", { name: "점수표" });
const categoryButton = (page: Page, name: string) =>
  scorecard(page).getByRole("button", { name, exact: true });
const rollButton = (page: Page) =>
  page.getByRole("button", { name: /^(주사위 던지기|다시 던지기)$/ });
const recordButton = (page: Page) => page.getByRole("button", { name: /^(0점으로 )?기록$/ });
const diceButtons = (page: Page) => page.getByRole("group", { name: "주사위" }).getByRole("button");
const helpDialog = (page: Page) => page.getByRole("dialog", { name: "플레이 방법" });
const muteButton = (page: Page) => page.getByRole("button", { name: "음소거" });

/** 두 상자가 겹치는지(px, 맞닿기만 하면 겹치지 않음). */
function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * 음소거 버튼이 「앞으로 n번」 칩·홀드 말풍선·성립 알림과 겹치지 않고, 눌러서 끄고 켤 수 있는지.
 * 덮인 버튼은 Playwright 가 누르지 못해 실패한다. 끝나면 처음처럼 소리가 켜진 상태로 돌려 둔다.
 */
async function expectMuteButtonClear(page: Page) {
  const mute = await muteButton(page).boundingBox();
  if (!mute) throw new Error("음소거 버튼이 없다");
  const others = [
    { what: "「앞으로 n번」", boxes: [await page.locator(".rolls-left").boundingBox()] },
    { what: "홀드 말풍선", boxes: await bubbleBoxes(page) },
    {
      what: "성립 알림",
      boxes: await page
        .locator(".callout-text")
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON())),
    },
  ];
  for (const { what, boxes } of others) {
    for (const box of boxes) {
      if (box)
        expect(boxesOverlap(mute, box), `음소거 버튼이 ${what} 와 겹치지 않는다`).toBe(false);
    }
  }
  await muteButton(page).click();
  await expect(muteButton(page)).toHaveAttribute("aria-pressed", "true");
  await muteButton(page).click();
  await expect(muteButton(page)).toHaveAttribute("aria-pressed", "false");
}

/** 그 카테고리 줄에서 그 플레이어 세로줄의 칸. */
const scoreCell = (page: Page, category: string, player: number) =>
  scorecard(page)
    .getByRole("row")
    // has 안의 locator 는 줄 안에서 찾는다.
    .filter({ has: page.getByRole("button", { name: category, exact: true }) })
    .getByRole("cell")
    .nth(player);

/** 보이지 않는 주사위 버튼들이 읽어 주는 것(화면 순서): 눈과 홀드 여부. */
async function diceState(page: Page): Promise<{ name: string; pressed: string | null }[]> {
  return diceButtons(page).evaluateAll((buttons) =>
    buttons.map((b) => ({
      name: b.textContent ?? "",
      pressed: b.getAttribute("aria-pressed"),
    })),
  );
}

async function expectDice(page: Page, values: number[], held: boolean[]) {
  await expect
    .poll(() => diceState(page))
    .toEqual(values.map((v, i) => ({ name: `주사위 ${v}`, pressed: String(held[i]) })));
}

/** 보이지 않는 주사위 버튼으로 홀드를 토글한다(화면 낭독기와 같은 길: 초점을 주고 Enter). */
async function holdByButton(page: Page, index: number) {
  await diceButtons(page).nth(index).press("Enter");
}

interface BubbleBox {
  die: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 지금 떠 있는 홀드 말풍선들. 화면 왼쪽부터. */
async function bubbleBoxes(page: Page): Promise<BubbleBox[]> {
  const boxes = await page.locator(".hold-bubble").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        die: el.getAttribute("data-die") ?? "",
        label: el.textContent ?? "",
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    }),
  );
  return boxes.sort((a, b) => a.x - b.x);
}

const bubble = (page: Page, die: string) => page.locator(`.hold-bubble[data-die="${die}"]`);

/** 판 위에 겹친 표시와 점수표 머리에서 지금 상태를 읽는다(플레이 방법을 닫은 뒤·새로고침 뒤 비교용). */
async function snapshot(page: Page) {
  return {
    turn: await scorecard(page).locator("th.turn span").textContent(),
    rollsLeft: await page.locator(".rolls-left").textContent(),
    nowPlayer: await scorecard(page).locator("thead th.now").textContent(),
    // 점수표 본문은 윗칸·초이스·아랫칸·총합 네 묶음이다.
    sheet: (await scorecard(page).locator("tbody").allInnerTexts()).join("\n"),
    dice: await diceState(page),
  };
}

/** 굴림 한 번 → 카테고리 선택 → 기록. 기록한 점수가 점수표에 들어갔는지 본다. */
async function rollAndRecord(page: Page, player: number, turn: number) {
  const category = CATEGORY_NAMES[turn - 1] ?? "";
  await expect(scorecard(page).locator("th.turn span")).toHaveText(`턴 ${turn}/12`);
  await expect(scorecard(page).locator("thead th.now")).toHaveText(PLAYERS[player] ?? "");
  await rollButton(page).click();
  await categoryButton(page, category).click();
  await recordButton(page).click();
  await expect(scoreCell(page, category, player)).toHaveText(
    String(EXPECTED_SCORES[player]?.[turn - 1]),
  );
}

/** 상자가 화면(뷰포트) 안에 다 들어오는지. */
async function expectInsideViewport(page: Page, target: Locator, what: string) {
  const viewport = page.viewportSize();
  const box = await target.boundingBox();
  expect(box, `${what} 가 보인다`).not.toBeNull();
  if (!box || !viewport) return;
  const inside =
    box.x >= -0.5 &&
    box.y >= -0.5 &&
    box.x + box.width <= viewport.width + 0.5 &&
    box.y + box.height <= viewport.height + 0.5;
  expect(inside, `${what} 가 화면 안에 있다: ${JSON.stringify(box)}`).toBe(true);
}

async function expectMinTarget(target: Locator, what: string) {
  const box = await target.boundingBox();
  expect(box, `${what} 가 보인다`).not.toBeNull();
  expect(box?.width ?? 0, `${what} 너비`).toBeGreaterThanOrEqual(MIN_TARGET);
  expect(box?.height ?? 0, `${what} 높이`).toBeGreaterThanOrEqual(MIN_TARGET);
}

test("2인 대전 한 판(새로고침 뒤 이어 하기 포함) 뒤 새 2인 대전을 확인 크기 네 곳에서 한 턴씩", async ({
  page,
}) => {
  await test.step("테스트용 빌드와 WebGL·동작 줄이기가 켜져 있다", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "요트" })).toBeVisible();
    await expect(page.getByText("이 기기에서는 3D를 지원하지 않습니다.")).toHaveCount(0);
    expect(
      await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2"))),
      "WebGL 2 를 쓸 수 있다",
    ).toBe(true);
    expect(await page.evaluate(() => window.__yachtDiceSource)).toBe(E2E_DICE_SOURCE_MARKER);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
  });

  await test.step("휴대폰 가로(667×375)에서도 시작 화면이 스크롤 없이 한 화면에 들어온다(1명·2명)", async () => {
    await page.setViewportSize({ width: 667, height: 375 });
    for (const count of ["1명", "2명"]) {
      await page.getByText(count, { exact: true }).click();
      // 시작 화면은 넘치면 자기 영역만 스크롤하므로(main), 그 영역이 넘치지 않는지 본다.
      await expect
        .poll(() =>
          page.evaluate(() => {
            const main = document.querySelector("main");
            return main ? main.scrollHeight <= main.clientHeight : false;
          }),
        )
        .toBe(true);
      await expectInsideViewport(
        page,
        page.getByRole("button", { name: count === "1명" ? "혼자 시작" : "대전 시작" }),
        `${count} 시작 버튼`,
      );
      await expectInsideViewport(
        page,
        page.getByRole("button", { name: "플레이 방법" }),
        "플레이 방법 버튼",
      );
    }
    await page.setViewportSize({ width: 375, height: 667 });
  });

  await test.step("시작 화면에서 플레이 방법의 세 탭을 차례로 보고 닫는다", async () => {
    await page.getByRole("button", { name: "플레이 방법" }).click();
    const dialog = helpDialog(page);
    await expect(dialog).toBeVisible();
    for (const [tab, content] of [
      ["플레이 방법", null],
      ["족보", "L. 스트레이트"],
      ["힌트", null],
    ] as const) {
      await dialog.getByRole("tab", { name: tab }).click();
      await expect(dialog.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
      await expect(dialog.getByRole("tabpanel")).not.toBeEmpty();
      if (content) {
        await expect(dialog.getByRole("heading", { name: content, exact: true })).toBeVisible();
      }
    }
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toHaveCount(0);
  });

  await test.step("2인 대전을 시작하면 3D 판 캔버스가 뜬다", async () => {
    await page.getByText("2명", { exact: true }).click();
    await page.getByRole("textbox", { name: "플레이어 1 이름" }).fill(PLAYERS[0]);
    await page.getByRole("textbox", { name: "플레이어 2 이름" }).fill(PLAYERS[1]);
    await page.getByRole("button", { name: "대전 시작" }).click();
    await expect(page.getByRole("img", { name: "주사위 판" })).toBeVisible();
    const canvas = page.locator(".board canvas");
    await expect(canvas).toBeVisible();
    expect(
      await canvas.evaluate((el) => (el as HTMLCanvasElement).getContext("webgl2") !== null),
      "3D 판이 WebGL 2 로 그린다",
    ).toBe(true);
    await expect(page.getByText("이 기기에서는 3D를 지원하지 않습니다.")).toHaveCount(0);
  });

  await test.step("턴 1 가영: 보이는 홀드 말풍선 탭 두 번", async () => {
    await expect(page.locator(".rolls-left")).toHaveText("앞으로 3번");
    await rollButton(page).click();
    // 눈 4·1·6·1·5 가 정렬 줄에 오름차순으로 놓인다.
    await expectDice(page, [1, 1, 4, 5, 6], [false, false, false, false, false]);
    await expect(page.locator(".hold-bubble")).toHaveCount(5);
    const before = await bubbleBoxes(page);
    expect(before.map((b) => b.label)).toEqual(["킵", "킵", "킵", "킵", "킵"]);
    const [first, second] = before;
    if (!first || !second) throw new Error("말풍선이 다섯 개여야 한다");
    const spacing = Math.min(...before.slice(1).map((b, i) => b.x - (before[i]?.x ?? 0)));

    // 맨 왼쪽(눈 1) 말풍선을 탭하면 그 주사위만 같은 열의 홀드 자리로 올라간다.
    await bubble(page, first.die).click();
    await expect(bubble(page, first.die)).toHaveText("되돌리기");
    await expectDice(page, [1, 1, 4, 5, 6], [true, false, false, false, false]);
    const afterFirst = await bubbleBoxes(page);
    const moved = afterFirst.find((b) => b.die === first.die);
    expect(moved, "누른 주사위의 말풍선").toBeDefined();
    if (!moved) return;
    expect(moved.y, "홀드 자리(위)로 올라간다").toBeLessThan(first.y - 5);
    expect(
      Math.abs(moved.x + moved.width / 2 - (first.x + first.width / 2)),
      "같은 열에 있다",
    ).toBeLessThan(spacing / 2);
    for (const b of before.filter((b) => b.die !== first.die)) {
      const now = afterFirst.find((a) => a.die === b.die);
      expect(now, `주사위 ${b.die} 의 말풍선이 남아 있다`).toBeDefined();
      expect(Math.abs((now?.x ?? 0) - b.x), `주사위 ${b.die} 말풍선 가로 위치`).toBeLessThan(0.5);
      expect(Math.abs((now?.y ?? 0) - b.y), `주사위 ${b.die} 말풍선 세로 위치`).toBeLessThan(0.5);
    }

    // 곧바로 다른 주사위(두 번째 1)의 말풍선을 탭하면 둘 다 홀드된다.
    await bubble(page, second.die).click();
    await expect(bubble(page, first.die)).toHaveText("되돌리기");
    await expect(bubble(page, second.die)).toHaveText("되돌리기");
    await expectDice(page, [1, 1, 4, 5, 6], [true, true, false, false, false]);
  });

  await test.step("게임 중 「?」로 플레이 방법을 열고 닫으면 상태가 그대로다", async () => {
    const before = await snapshot(page);
    expect(before.turn).toBe("턴 1/12");
    expect(before.rollsLeft).toBe("앞으로 2번");
    await scorecard(page).getByRole("button", { name: "플레이 방법" }).click();
    const dialog = helpDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("tab", { name: "족보" }).click();
    await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);
  });

  await test.step("턴 1 가영: 보이지 않는 주사위 버튼으로 홀드하며 세 번 굴리고 에이스에 기록", async () => {
    await rollButton(page).click();
    // 홀드 자리 1·1, 다시 굴린 3·1·2 는 정렬 줄에 자기들끼리 오름차순.
    await expectDice(page, [1, 1, 1, 2, 3], [true, true, false, false, false]);
    await expect(page.locator(".rolls-left")).toHaveText("앞으로 1번");
    await holdByButton(page, 2);
    await expectDice(page, [1, 1, 1, 2, 3], [true, true, true, false, false]);
    await rollButton(page).click();
    await expect(page.locator(".rolls-left")).toHaveText("앞으로 0번");
    // 3번째 굴림 뒤에는 다섯 개가 홀드 자리에 모이고, 버튼은 홀드 여부 없이 눈만 읽는다.
    await expect
      .poll(() => diceState(page))
      .toEqual([1, 1, 1, 2, 3].map((v) => ({ name: `주사위 ${v}`, pressed: null })));
    await expect(rollButton(page)).toBeHidden();
    await expect(page.locator(".hold-bubble")).toHaveCount(0);
    await categoryButton(page, "에이스").click();
    await expect(recordButton(page)).toHaveText("기록");
    await recordButton(page).click();
    await expect(scoreCell(page, "에이스", 0)).toHaveText("3");
    await expect(page.getByRole("status").filter({ hasText: "다음은 나래 차례" })).toBeVisible();
  });

  await test.step("턴 1 나래, 턴 2 가영", async () => {
    await rollAndRecord(page, 1, 1);
    await rollAndRecord(page, 0, 2);
  });

  await test.step("턴 2 나래: 홀드한 채로 새로고침 → 이어 하기 → 같은 턴·점수표·주사위", async () => {
    await rollButton(page).click();
    // 눈 5·2·1·2·3 → 1·2·2·3·5. 2 두 개를 보이지 않는 주사위 버튼으로 홀드한다.
    await expectDice(page, [1, 2, 2, 3, 5], [false, false, false, false, false]);
    await holdByButton(page, 1);
    await expectDice(page, [2, 1, 2, 3, 5], [true, false, false, false, false]);
    await holdByButton(page, 2);
    await expectDice(page, [2, 2, 1, 3, 5], [true, true, false, false, false]);
    const before = await snapshot(page);
    expect(before.turn).toBe("턴 2/12");
    expect(before.nowPlayer).toBe("나래");

    await page.reload();
    await page.getByRole("button", { name: "이어 하기" }).click();
    await expect(page.getByRole("img", { name: "주사위 판" })).toBeVisible();
    await expect.poll(() => snapshot(page)).toEqual(before);

    await categoryButton(page, "듀스").click();
    await recordButton(page).click();
    await expect(scoreCell(page, "듀스", 1)).toHaveText("4");
  });

  await test.step("턴 3~12 를 끝까지 진행한다", async () => {
    for (let turn = 3; turn <= 12; turn += 1) {
      await rollAndRecord(page, 0, turn);
      if (turn === 6) {
        // 가영은 윗칸 소계 63 으로 보너스 +35.
        await expect(
          scorecard(page)
            .getByRole("row", { name: /^보너스\+35/ })
            .getByRole("cell")
            .nth(0),
        ).toHaveText("35");
      }
      if (turn === 12) break;
      await rollAndRecord(page, 1, turn);
    }
    // 마지막 기록(나래 턴 12, 요트 스크래치)은 기록 뒤 결과 화면이 떠서 점수표 대신 순위 표로 확인한다.
    await expect(scorecard(page).locator("th.turn span")).toHaveText("턴 12/12");
    await rollButton(page).click();
    await categoryButton(page, "요트").click();
    await expect(recordButton(page)).toHaveText("0점으로 기록");
    await recordButton(page).click();
  });

  await test.step("결과 화면: 순위 표 → 다음 → 승자 1등 → 처음으로", async () => {
    await expect(page.getByRole("heading", { name: "결과" })).toBeVisible();
    const rows = page.getByRole("table", { name: "순위" }).locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByRole("cell")).toHaveText([
      "1위",
      PLAYERS[0],
      String(EXPECTED_TOTALS[0]),
    ]);
    await expect(rows.nth(1).getByRole("cell")).toHaveText([
      "2위",
      PLAYERS[1],
      String(EXPECTED_TOTALS[1]),
    ]);

    await page.getByRole("button", { name: "다음" }).click();
    await expect(page.getByRole("heading", { name: "Winner!" })).toBeVisible();
    const winners = page.locator(".winners li");
    await expect(winners).toHaveCount(1);
    await expect(winners.locator(".winner-name")).toHaveText(PLAYERS[0]);
    await expect(winners.locator(".winner-total")).toHaveText(`총합 득점 ${EXPECTED_TOTALS[0]}`);

    await page.getByRole("button", { name: "처음으로" }).click();
    await expect(page.getByRole("heading", { name: "요트" })).toBeVisible();
    await expect(page.getByRole("button", { name: "대전 시작" })).toBeVisible();
    // 끝난 게임은 이어 하기 대상이 아니다.
    await expect(page.getByRole("button", { name: "이어 하기" })).toHaveCount(0);
  });

  await test.step("같은 두 사람으로 새 대전을 시작한다(인원은 지금 2명까지)", async () => {
    // 인원 선택지는 1~2명뿐이다(MAX_PLAYERS, 2026-10-25 결정).
    await expect(page.getByRole("radio")).toHaveCount(2);
    await page.getByText("2명", { exact: true }).click();
    await page.getByRole("button", { name: "대전 시작" }).click();
    await expect(page.getByRole("img", { name: "주사위 판" })).toBeVisible();
    await expect(scorecard(page).locator("thead th")).toHaveCount(3);
  });

  // 확인 크기마다 한 턴: 두 사람이 번갈아 하므로 같은 사람의 두 번째 턴은 다른 카테고리에 기록한다.
  const turnCategories = ["초이스", "초이스", "식스", "식스"] as const;
  for (const [step, size] of CHECK_SIZES.entries()) {
    const player = step % PLAYERS.length;
    const category = turnCategories[step] ?? "초이스";
    await test.step(`${size.name} ${size.width}×${size.height}: 배치 확인 뒤 한 턴`, async () => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await expect(scorecard(page).locator("thead th.now")).toHaveText(PLAYERS[player] ?? "");

      // 조작 전에: 스크롤이 없고, 판 영역·점수표·버튼이 화면 안에 있고, 누르는 영역이 24px 이상.
      await expect
        .poll(() =>
          page.evaluate(() => ({
            x: document.documentElement.scrollWidth <= window.innerWidth,
            y: document.documentElement.scrollHeight <= window.innerHeight,
          })),
        )
        .toEqual({ x: true, y: true });
      await expectInsideViewport(page, page.locator(".board"), "판 영역");
      await expectInsideViewport(page, scorecard(page), "점수표");
      await expectInsideViewport(page, page.locator(".actions"), "버튼 줄");
      for (const name of CATEGORY_NAMES) {
        await expectInsideViewport(page, categoryButton(page, name), `카테고리 ${name}`);
        await expectMinTarget(categoryButton(page, name), `카테고리 ${name}`);
      }
      await expectMinTarget(rollButton(page), "굴림 버튼");
      await expectMinTarget(recordButton(page), "기록 버튼");
      await expectInsideViewport(page, muteButton(page), "음소거 버튼");
      await expectMinTarget(muteButton(page), "음소거 버튼");

      // 굴림 → 보이는 홀드 말풍선 탭 → 카테고리 탭 → 기록. 덮인 대상은 Playwright 가 누르지 못해 실패한다.
      await rollButton(page).click();
      await expect(page.locator(".hold-bubble")).toHaveCount(5);
      await expectMuteButtonClear(page);
      const [leftmost] = await bubbleBoxes(page);
      if (!leftmost) throw new Error("말풍선이 없다");
      await bubble(page, leftmost.die).click();
      await expect(bubble(page, leftmost.die)).toHaveText("되돌리기");
      await expect(diceButtons(page).nth(0)).toHaveAttribute("aria-pressed", "true");
      await categoryButton(page, category).click();
      await recordButton(page).click();
      await expect(scoreCell(page, category, player)).not.toBeEmpty();
    });
  }
});
