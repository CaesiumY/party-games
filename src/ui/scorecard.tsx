import { scorePreview } from "../engine/game";
import { totalScore, UPPER_BONUS_THRESHOLD, upperBonus, upperSubtotal } from "../engine/totals";
import { CATEGORIES, type Category } from "../engine/types";
import { useGame, usePermissions, usePreviewVisible, useShownPlayer } from "../store/store-context";
import { CATEGORY_NAMES } from "./category-names";
import { HowToPlayButton } from "./how-to-play";

const UPPER = CATEGORIES.slice(0, 6);
const LOWER = CATEGORIES.slice(6);

/** 점수표: 표 하나, 카테고리마다 가로줄, 플레이어마다 세로줄(스펙 「화면 배치」). */
export function Scorecard() {
  const game = useGame((s) => s.game);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const showPreview = usePreviewVisible();
  const can = usePermissions();
  // 차례 강조는 화면의 지금 차례(보너스 알림 동안은 방금 기록한 플레이어)를 따른다.
  const now = useShownPlayer();
  const callout = useGame((s) => s.callout?.category ?? null);
  const bonusPlayer = useGame((s) => s.bonusNotice?.player ?? null);

  const row = (category: Category) => {
    const selected = selection === category;
    const selectable = can.canSelect(category);
    return (
      <tr key={category} className={selected ? "cat selected" : "cat"}>
        <th scope="row">
          <button
            type="button"
            className="cat-button"
            aria-pressed={selected}
            disabled={!selectable}
            onClick={() => select(category)}
          >
            {CATEGORY_NAMES[category]}
          </button>
        </th>
        {game.players.map((player, i) => {
          const recorded = player.scores[category];
          const isCurrent = i === game.currentPlayer;
          const preview = isCurrent && showPreview && recorded === undefined;
          const shown = recorded ?? (preview ? scorePreview(game, category) : undefined);
          // 성립 알림이 떠 있는 동안 지금 플레이어의 그 칸이 빛난다. 이미 기록한 칸은 빛나지 않는다.
          const glow = isCurrent && callout === category && recorded === undefined;
          return (
            <td
              key={player.name}
              className={[
                i === now && "now",
                recorded === undefined && preview && "preview",
                glow && "callout",
                glow && category === "yacht" && "yacht",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {shown}
            </td>
          );
        })}
      </tr>
    );
  };

  const line = (
    className: string,
    label: string,
    value: (i: number) => string | number,
    glow: (i: number) => boolean = () => false,
  ) => (
    <tr className={className}>
      <th scope="row">{label}</th>
      {game.players.map((player, i) => (
        <td
          key={player.name}
          className={
            [i === now && "now", glow(i) && "bonus"].filter(Boolean).join(" ") || undefined
          }
        >
          {value(i)}
        </td>
      ))}
    </tr>
  );

  const player = (i: number) => game.players[i] ?? { name: "", scores: {} };

  return (
    <section className="sheet" aria-label="점수표">
      <table className="scorecard">
        <colgroup>
          <col className="name-col" />
          {game.players.map((p) => (
            <col key={p.name} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="turn">
              <span>턴 {Math.min(game.turn, 12)}/12</span>
              <HowToPlayButton className="help" disabled={!can.canOpenHelp}>
                ?
              </HowToPlayButton>
            </th>
            {game.players.map((p, i) => (
              <th key={p.name} scope="col" className={i === now ? "now" : undefined}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(row)}
          {line(
            "sub",
            "소계",
            (i) => `${upperSubtotal(player(i))}/${UPPER_BONUS_THRESHOLD}`,
            // 보너스 알림 동안 방금 기록한 플레이어의 소계 칸이 빛난다.
            (i) => i === bonusPlayer,
          )}
          {line("sub", "보너스+35", (i) => upperBonus(player(i)) || "")}
          {LOWER.map(row)}
          {line("total", "총합 득점", (i) => totalScore(player(i)))}
        </tbody>
      </table>
    </section>
  );
}
