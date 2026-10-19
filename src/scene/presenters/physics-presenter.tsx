import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { restPose } from "../../layout/placement";
import { DieMesh } from "../die-mesh";
import type { PresentedDie, RollPresenterProps } from "../roll-presenter";
import { loadRapier } from "./physics/load-rapier";
import { preRoll, type RollPlan } from "./physics/pre-roll";
import { replayAt } from "./physics/replay";

/** 멈춘 뒤 정렬 자리로 옮기기 전에 멈춘 자세를 보여 주는 시간(ms). 정렬 애니메이션은 #11 이 한다. */
const STOPPED_HOLD_MS = 500;

interface Playing {
  rollId: number;
  plan: RollPlan;
}

/**
 * 물리 굴림 연출(스펙 「굴림 연출」 2단계). 굴림마다 화면 밖에서 Rapier 로 미리 굴려 궤적을 얻고,
 * 멈췄을 때 굴림 결과의 눈이 위로 보이도록 면을 맞춘 뒤, 같은 궤적을 화면에서 재생한다.
 * 재생이 끝나면 멈춤을 알리고, 잠깐 뒤 주사위를 정렬 자리에 바로 놓고 정렬 끝을 알린다.
 *
 * 홀드 자리의 주사위는 굴리지 않는다(시뮬레이션에서는 고정 장애물). 미리 굴리기가 끝내 알맞은 멈춤을
 * 얻지 못하거나 물리 엔진을 불러오지 못하면 순간 배치처럼 바로 놓는다.
 * 처음 그릴 때 이미 있던 굴림(다른 연출에서 바꿔 끼운 경우)은 연출하지 않고 정렬된 채로 둔다.
 */
export function PhysicsPresenter({ rollId, dice, onStopped, onLinedUp }: RollPresenterProps) {
  const latest = useRef({ dice, onStopped, onLinedUp });
  latest.current = { dice, onStopped, onLinedUp };
  /** 연출을 끝낸(정렬된 채로 보여 줄) 굴림. */
  const [presented, setPresented] = useState(rollId);
  const presentedRef = useRef(presented);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void loadRapier().catch(() => {});
    return () => clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    const { onStopped: stopped, onLinedUp: linedUp } = latest.current;
    if (rollId === 0) return;
    if (rollId === presentedRef.current) {
      stopped(rollId);
      linedUp(rollId);
      return;
    }
    let cancelled = false;
    const placeNow = () => {
      if (cancelled) return;
      presentedRef.current = rollId;
      setPresented(rollId);
      stopped(rollId);
      linedUp(rollId);
    };
    loadRapier()
      .then((rapier) => {
        if (cancelled) return;
        const plan = preRoll(rapier, planInput(latest.current.dice));
        if (!plan) return placeNow();
        setPlaying({ rollId, plan });
      })
      .catch(placeNow);
    return () => {
      cancelled = true;
    };
  }, [rollId]);

  const finish = (roll: Playing) => {
    latest.current.onStopped(roll.rollId);
    timer.current = setTimeout(() => {
      presentedRef.current = roll.rollId;
      setPresented(roll.rollId);
      setPlaying((now) => (now === roll ? null : now));
      latest.current.onLinedUp(roll.rollId);
    }, STOPPED_HOLD_MS);
  };

  // 굴림을 연출하는 동안 굴린 주사위는 재생 쪽이 그린다. 미리 굴리기를 기다리는 사이에는
  // 새 눈이 정렬 줄에 먼저 보이지 않도록 굴릴 주사위를 그리지 않는다.
  const settled = presented === rollId && playing === null;
  return (
    <group>
      {dice
        .filter((die) => die.held || settled)
        .map((die) => {
          const pose = restPose(die);
          return <DieMesh key={die.id} position={pose.position} rotation={pose.rotation} />;
        })}
      {playing && <Replay key={playing.rollId} playing={playing} onDone={finish} />}
    </group>
  );
}

function planInput(dice: readonly PresentedDie[]) {
  return {
    seed: crypto.getRandomValues(new Uint32Array(1))[0] ?? 1,
    rolling: dice.filter((d) => !d.held).map(({ id, value }) => ({ id, value })),
    heldColumns: dice.filter((d) => d.held).map((d) => d.column),
  };
}

/**
 * 궤적 재생. 프레임마다 경과 시간으로 궤적을 읽어 주사위 자세를 바꾼다.
 * 캔버스는 요청할 때만 그리므로(frameloop="demand") 재생 중에는 매 프레임 다시 그리기를 요청한다.
 */
function Replay({ playing, onDone }: { playing: Playing; onDone(roll: Playing): void }) {
  const invalidate = useThree((s) => s.invalidate);
  const groups = useRef<(Group | null)[]>([]);
  const started = useRef<number | null>(null);
  const done = useRef(false);
  const first = useMemo(() => replayAt(playing.plan, 0).poses, [playing.plan]);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    if (done.current) return;
    const now = performance.now();
    started.current ??= now;
    const frame = replayAt(playing.plan, (now - started.current) / 1000);
    frame.poses.forEach((pose, i) => {
      const group = groups.current[i];
      if (!group) return;
      group.position.set(...pose.position);
      group.quaternion.copy(pose.quaternion);
    });
    if (frame.done) {
      done.current = true;
      onDone(playing);
    }
    invalidate();
  });

  return (
    <>
      {first.map((pose, i) => (
        <group
          key={pose.id}
          ref={(g) => {
            groups.current[i] = g;
          }}
          position={pose.position as [number, number, number]}
          quaternion={pose.quaternion}
        >
          <DieMesh position={[0, 0, 0]} rotation={[0, 0, 0]} />
        </group>
      ))}
    </>
  );
}
