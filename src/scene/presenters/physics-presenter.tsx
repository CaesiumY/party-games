import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { Group } from "three";
import type { DieId } from "../../engine/types";
import { hitSchedule } from "../../sound/hit-schedule";
import type { RollSound, Voice } from "../../sound/sound";
import { useRollSound } from "../../sound/sound-context";
import { CupShape } from "../cup-mesh";
import { DieMesh } from "../die-mesh";
import type { PresentedDie, RollPresenterProps } from "../roll-presenter";
import { cupPose } from "./physics/cup-pour";
import { loadRapier } from "./physics/load-rapier";
import { preRoll } from "./physics/pre-roll";
import {
  type Move,
  moveFrame,
  pourTime,
  type RollScript,
  rollFrame,
  type ShownPose,
  slotPose,
  soundCues,
} from "./physics/timeline";

const IDS: readonly DieId[] = [0, 1, 2, 3, 4];

/** 주사위가 지금 보이는 자리. 자리가 바뀌었는지 비교하는 데 쓴다. */
interface ShownSlot {
  held: boolean;
  column: number;
  value: number;
}

const slotOf = (die: PresentedDie): ShownSlot => ({
  held: die.held,
  column: die.column,
  value: die.value,
});
const sameSlot = (a: ShownSlot | undefined, b: ShownSlot) =>
  a?.held === b.held && a.column === b.column && a.value === b.value;

const now = () => performance.now() / 1000;

/** 물리 없이 바로 놓을 때(미리 굴리기 실패) 주사위가 판에 닿는 소리의 세기. */
const LANDING_STRENGTH = 3;

/** 연출 시계의 시각들을 효과음에 넘길 "지금부터 몇 초 뒤"로 바꿔 충돌음을 낸다. */
function playHits(sound: RollSound, hits: readonly { at: number; strength: number }[]): Voice {
  const t = now();
  return sound.hits(hitSchedule(hits).map((hit) => ({ delay: hit.at - t, gain: hit.gain })));
}

type Shown = Map<DieId, { pose: ShownPose; visible: boolean; slot: ShownSlot }>;

/** 주사위마다 지금 보이는 자세를 그 주사위의 그룹에 옮긴다. */
function applyShown(groups: readonly (Group | null)[], shown: Shown) {
  for (const id of IDS) {
    const group = groups[id];
    const state = shown.get(id);
    if (!group || !state) continue;
    group.position.set(...state.pose.position);
    group.quaternion.copy(state.pose.quaternion);
    group.visible = state.visible;
  }
}

function placeCup(cup: Group | null, pose = cupPose(0, { forward: 0, side: 0, lift: 0 })) {
  if (!cup) return;
  cup.position.set(...pose.position);
  cup.quaternion.copy(pose.quaternion);
}

/**
 * 물리 굴림 연출(스펙 「굴림 연출」 세 단계). 정렬 줄의 주사위를 컵에 모아 흔들고 쏟은 뒤,
 * 화면 밖에서 Rapier 로 미리 굴린 궤적을 재생하고, 멈춘 자세를 잠깐 보여 준 다음 떠올라 정렬 자리로 간다.
 * 시간표는 physics/timeline.ts 의 순수 계산이고, 여기서는 프레임마다 그 값을 주사위와 컵에 옮긴다.
 *
 * 홀드 자리의 주사위는 컵과 굴러감 동안 움직이지 않는다(시뮬레이션에서는 고정 장애물이고, 그 자리는
 * 저장소가 이미 바꿔 둔 새 열이 아니라 지금 보이는 열이다). 정렬 때 새 열로 옮긴다.
 * 굴림이 아닌 자리 바뀜(홀드·홀드 풀기, 3번째 굴림 뒤 올라감, 다음 턴에 내려옴)은 짧게 옮기고
 * 다 옮기면 주사위마다 알린다.
 *
 * 효과음: 컵이 흔들리는 동안 흔드는 소리를, 궤적을 재생하며 미리 굴리기에서 기록한 부딪힘마다 충돌음을 낸다.
 * 굴림이 바뀌거나 이 연출이 사라지면('동작 줄이기'를 켜 순간 배치로 바뀐 때 등) 아직 안 난 소리를 거둔다.
 *
 * 미리 굴리기가 끝내 알맞은 멈춤을 얻지 못하거나 물리 엔진을 불러오지 못하면 순간 배치처럼 바로 놓고,
 * 놓는 순간 충돌음을 낸다.
 * 처음 그릴 때 이미 있던 굴림(다른 연출에서 바꿔 끼운 경우)은 연출하지 않고 정렬된 채로 둔다.
 */
export function PhysicsPresenter({
  rollId,
  dice,
  onStopped,
  onLinedUp,
  onDieSettled,
}: RollPresenterProps) {
  const invalidate = useThree((s) => s.invalidate);
  const sound = useRollSound();
  const latest = useRef({ dice, onStopped, onLinedUp, onDieSettled, sound });
  latest.current = { dice, onStopped, onLinedUp, onDieSettled, sound };

  const groups = useRef<(Group | null)[]>([]);
  const cup = useRef<Group>(null);
  /** 주사위마다 지금 보이는 자세·자리. */
  const shown = useRef<Shown>(
    new Map(dice.map((die) => [die.id, { pose: slotPose(die), visible: true, slot: slotOf(die) }])),
  );
  const presented = useRef(rollId);
  const script = useRef<{ rollId: number; roll: RollScript; stoppedSent: boolean } | null>(null);
  const moves = useRef(new Map<DieId, Move>());

  // 처음 그릴 때 자리를 잡는다. 그 뒤로 주사위와 컵의 자세는 프레임마다 직접 바꾼다(props 로 넘기지 않음).
  useLayoutEffect(() => {
    applyShown(groups.current, shown.current);
    placeCup(cup.current);
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    void loadRapier().catch(() => {});
  }, []);

  // 굴림: 새 rollId 면 컵 → 굴러감 → 정렬을 시작한다.
  useEffect(() => {
    const { onStopped: stopped, onLinedUp: linedUp } = latest.current;
    const voices: Voice[] = [];
    /** 굴림 연출을 건너뛰고 정렬 자리에 바로 놓는다. */
    const placeNow = () => {
      // 흔드는 소리를 그치고, 굴린 주사위가 판에 놓이는 지금 충돌음을 낸다.
      for (const voice of voices) voice.stop();
      const landing = latest.current.dice.filter((die) => !die.held);
      voices.push(
        playHits(
          latest.current.sound,
          landing.map(() => ({ at: now(), strength: LANDING_STRENGTH })),
        ),
      );
      script.current = null;
      presented.current = rollId;
      for (const die of latest.current.dice) {
        shown.current.set(die.id, { pose: slotPose(die), visible: true, slot: slotOf(die) });
      }
      applyShown(groups.current, shown.current);
      placeCup(cup.current);
      invalidate();
      latest.current.onStopped(rollId);
      latest.current.onLinedUp(rollId);
    };
    if (rollId === 0) return;
    if (rollId === presented.current) {
      stopped(rollId);
      linedUp(rollId);
      return;
    }
    const all = latest.current.dice;
    const t = now();
    const fromOf = (die: PresentedDie) => shown.current.get(die.id)?.pose ?? slotPose(die);
    // 굴리는 동안 홀드 자리의 주사위는 지금 보이는 자리에 있다(새 열로는 정렬 때 옮긴다).
    const held = all.filter((die) => die.held);
    const rolling = all.filter((die) => !die.held);
    moves.current.clear();
    const roll: RollScript = {
      start: t,
      rolling: rolling.map((die) => ({ id: die.id, from: fromOf(die), to: slotPose(die) })),
      held: held.map((die) => ({ id: die.id, from: fromOf(die), to: slotPose(die) })),
      plan: null,
      pourAt: null,
    };
    script.current = { rollId, roll, stoppedSent: false };
    invalidate();
    const shake = latest.current.sound.shake(soundCues(roll).shakeFrom - t);
    voices.push(shake);

    let cancelled = false;
    loadRapier()
      .then((rapier) => {
        if (cancelled || script.current?.roll !== roll) return;
        const plan = preRoll(rapier, {
          seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
          rolling: rolling.map(({ id, value }) => ({ id, value })),
          heldColumns: held.map((die) => shown.current.get(die.id)?.slot.column ?? die.column),
        });
        if (!plan) return placeNow();
        roll.plan = plan;
        roll.pourAt = pourTime(roll, now());
        const cues = soundCues(roll);
        shake.stop((cues.shakeUntil ?? now()) - now());
        voices.push(playHits(latest.current.sound, cues.hits));
        invalidate();
      })
      .catch(() => {
        if (!cancelled && script.current?.roll === roll) placeNow();
      });
    return () => {
      cancelled = true;
      for (const voice of voices) voice.stop();
    };
  }, [rollId, invalidate]);

  // 굴림이 아닌 자리 바뀜: 바뀐 주사위만 새 자리로 옮기고, 가만히 있는 주사위는 놓였다고 알린다.
  useEffect(() => {
    if (script.current) return;
    const t = now();
    for (const die of dice) {
      const state = shown.current.get(die.id);
      const slot = slotOf(die);
      if (state && !sameSlot(state.slot, slot)) {
        moves.current.set(die.id, { from: state.pose, to: slotPose(die), start: t });
        state.slot = slot;
      } else if (!moves.current.has(die.id)) {
        latest.current.onDieSettled(die.id);
      }
    }
    if (moves.current.size > 0) invalidate();
  }, [dice, invalidate]);

  useFrame(() => {
    const t = now();
    let active = false;
    const running = script.current;
    if (running) {
      active = true;
      const frame = rollFrame(running.roll, t);
      for (const die of frame.dice) {
        const state = shown.current.get(die.id);
        if (!state) continue;
        state.pose = { position: die.position, quaternion: die.quaternion };
        state.visible = die.visible;
      }
      placeCup(cup.current, frame.cup);
      if (frame.stopped && !running.stoppedSent) {
        running.stoppedSent = true;
        latest.current.onStopped(running.rollId);
      }
      if (frame.linedUp) {
        script.current = null;
        presented.current = running.rollId;
        for (const die of latest.current.dice) {
          const state = shown.current.get(die.id);
          if (state) state.slot = slotOf(die);
        }
        latest.current.onLinedUp(running.rollId);
      }
    }
    for (const [id, move] of moves.current) {
      active = true;
      const frame = moveFrame(move, t);
      const state = shown.current.get(id);
      if (state) state.pose = frame.pose;
      if (frame.done) {
        moves.current.delete(id);
        latest.current.onDieSettled(id);
      }
    }
    applyShown(groups.current, shown.current);
    if (active) invalidate();
  });

  return (
    <group>
      <group ref={cup}>
        <CupShape />
      </group>
      {IDS.map((id) => (
        <group
          key={id}
          ref={(g) => {
            groups.current[id] = g;
          }}
        >
          <DieMesh position={[0, 0, 0]} rotation={[0, 0, 0]} />
        </group>
      ))}
    </group>
  );
}
