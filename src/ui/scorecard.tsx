import { currentValues } from "../engine/game";
import { scoreFor } from "../engine/scoring";
import { totalScore, upperSubtotal } from "../engine/totals";
import { CATEGORIES, type Category } from "../engine/types";
import { useGame, usePermissions, usePreviewVisible } from "../store/store-context";
import { CATEGORY_NAMES } from "./category-names";

const UPPER = CATEGORIES.slice(0, 6);
const LOWER = CATEGORIES.slice(6);

/** 점수표: 표 하나, 카테고리마다 가로줄, 플레이어마다 세로줄(스펙 「화면 배치」). */
export function Scorecard() {
  const game = useGame((s) => s.game);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const showPreview = usePreviewVisible();
  const can = usePermissions();
  const values = currentValues(game);

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
          const shown = recorded ?? (preview ? scoreFor(category, values) : undefined);
          return (
            <td
              key={player.name}
              className={[isCurrent && "now", recorded === undefined && preview && "preview"]
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

  const line = (className: string, label: string, value: (i: number) => string | number) => (
    <tr className={className}>
      <th scope="row">{label}</th>
      {game.players.map((player, i) => (
        <td key={player.name} className={i === game.currentPlayer ? "now" : undefined}>
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
              턴 {Math.min(game.turn, 12)}/12
            </th>
            {game.players.map((p, i) => (
              <th key={p.name} scope="col" className={i === game.currentPlayer ? "now" : undefined}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPPER.map(row)}
          {line("sub", "소계", (i) => `${upperSubtotal(player(i))}/63`)}
          {line("sub", "보너스+35", () => "")}
          {LOWER.map(row)}
          {line("total", "총합 득점", (i) => totalScore(player(i)))}
        </tbody>
      </table>
    </section>
  );
}
