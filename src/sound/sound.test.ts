import { describe, expect, it } from "vitest";
import { type AudioOut, createSound } from "./sound";

/** 재생한 소리를 적어 두는 가짜 Web Audio. 버퍼는 이름만 있는 무음 자리 채움이다. */
function fakeAudio() {
  const log: {
    clip: string;
    at: number;
    loop: boolean;
    gain: number;
    stoppedAt: number | null;
  }[] = [];
  const master = { value: 1 };
  let gains = 0;
  const audio = {
    currentTime: 0,
    state: "suspended",
    destination: {},
    resumed: 0,
    resume() {
      audio.resumed++;
      audio.state = "running";
      return Promise.resolve();
    },
    async decodeAudioData(data: ArrayBuffer) {
      return { clip: new TextDecoder().decode(data) };
    },
    createGain() {
      // 처음 만드는 이득 노드가 전체 소리 크기(음소거)다.
      const param = gains++ === 0 ? master : { value: 1 };
      const node = {
        gain: {
          get value() {
            return param.value;
          },
          set value(v: number) {
            param.value = v;
          },
          setValueAtTime(v: number) {
            param.value = v;
          },
          linearRampToValueAtTime() {},
          cancelScheduledValues() {},
        },
        connect() {},
      };
      return node;
    },
    createBufferSource() {
      let entry: (typeof log)[number] | null = null;
      const source = {
        buffer: null as { clip: string } | null,
        loop: false,
        playbackRate: { value: 1 },
        gainNode: null as { gain: { value: number } } | null,
        connect(node: { gain: { value: number } }) {
          source.gainNode = node;
        },
        start(when = 0) {
          entry = {
            clip: source.buffer?.clip ?? "?",
            at: when,
            loop: source.loop,
            gain: source.gainNode?.gain.value ?? 1,
            stoppedAt: null,
          };
          log.push(entry);
        },
        stop(when = 0) {
          if (entry) entry.stoppedAt = when;
        },
      };
      return source;
    },
  };
  return { audio, log, master };
}

const CLIPS = { shake: ["shake-a"], hit: ["hit-a", "hit-b"] };
/** 파일 대신 이름을 담은 바이트를 돌려준다. */
const load = async (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const fake = fakeAudio();
  let created = 0;
  const sound = createSound({
    clips: CLIPS,
    load,
    createContext: () => {
      created++;
      return fake.audio as unknown as AudioOut;
    },
  });
  return { ...fake, sound, created: () => created };
}

describe("효과음", () => {
  it("첫 굴림 탭으로 풀기 전에는 소리를 내려 해도 아무 일도 없고 오류도 나지 않는다", async () => {
    const { sound, log, created } = setup();
    expect(() => {
      sound.shake(0).stop(1);
      sound.hits([{ delay: 0, gain: 1 }]).stop();
    }).not.toThrow();
    await flush();
    expect(created()).toBe(0);
    expect(log).toEqual([]);
  });

  it("풀면 오디오를 깨우고, 충돌음을 정한 시각에 정한 크기로 울리며 변형을 번갈아 쓴다", async () => {
    const { sound, audio, log } = setup();
    sound.unlock();
    expect(audio.resumed).toBe(1);
    await flush();
    audio.currentTime = 3;
    sound.hits([
      { delay: 0.1, gain: 1 },
      { delay: 0.4, gain: 0.5 },
      { delay: 0.6, gain: 0.25 },
    ]);
    await flush();
    expect(log.map(({ clip, at, gain }) => ({ clip, at, gain }))).toEqual([
      { clip: "hit-a", at: 3.1, gain: 1 },
      { clip: "hit-b", at: 3.4, gain: 0.5 },
      { clip: "hit-a", at: 3.6, gain: 0.25 },
    ]);
  });

  it("두 번 풀어도 오디오는 하나다", async () => {
    const { sound, created } = setup();
    sound.unlock();
    sound.unlock();
    await flush();
    expect(created()).toBe(1);
  });

  it("컵 흔드는 소리는 그칠 때까지 되풀이하고, 그치라는 시각에 잦아든다", async () => {
    const { sound, audio, log } = setup();
    sound.unlock();
    await flush();
    audio.currentTime = 1;
    const shake = sound.shake(0.25);
    await flush();
    expect(log).toMatchObject([{ clip: "shake-a", at: 1.25, loop: true, stoppedAt: null }]);
    shake.stop(0.5);
    expect(log[0]?.stoppedAt).toBeGreaterThanOrEqual(1.5);
    expect(log[0]?.stoppedAt).toBeLessThan(1.7);
  });

  it("푼 직후 음원을 아직 읽는 중이어도, 그 사이 시작한 흔드는 소리는 읽기가 끝나면 난다", async () => {
    const { sound, log } = setup();
    sound.unlock();
    sound.shake(0.2);
    expect(log).toEqual([]);
    await flush();
    expect(log).toMatchObject([{ clip: "shake-a", loop: true }]);
  });

  it("굴림이 바뀌거나 연출이 사라지면 아직 울리지 않은 충돌음과 흔드는 소리를 거둔다", async () => {
    const { sound, audio, log } = setup();
    sound.unlock();
    await flush();
    audio.currentTime = 2;
    const shake = sound.shake(0);
    const hits = sound.hits([
      { delay: 0.5, gain: 1 },
      { delay: 0.9, gain: 1 },
    ]);
    await flush();
    shake.stop();
    hits.stop();
    expect(log.every((entry) => entry.stoppedAt !== null && entry.stoppedAt <= 2.1)).toBe(true);
  });

  it("음소거면 새 소리를 내지 않고, 울리던 소리도 곧바로 끈다", async () => {
    const { sound, master, log } = setup();
    sound.unlock();
    await flush();
    sound.shake(0);
    await flush();
    sound.setMuted(true);
    expect(master.value).toBe(0);
    sound.hits([{ delay: 0, gain: 1 }]);
    await flush();
    expect(log.map((e) => e.clip)).toEqual(["shake-a"]);
    sound.setMuted(false);
    expect(master.value).toBe(1);
  });

  it("처음부터 음소거였으면 풀어도 소리가 나지 않는다", async () => {
    const { sound, master, log } = setup();
    sound.setMuted(true);
    sound.unlock();
    await flush();
    sound.hits([{ delay: 0, gain: 1 }]);
    await flush();
    expect(master.value).toBe(0);
    expect(log).toEqual([]);
  });

  it("Web Audio 를 쓸 수 없는 브라우저에서는 풀어도 조용히 넘어간다", async () => {
    const sound = createSound({
      clips: CLIPS,
      load,
      createContext: () => {
        throw new Error("no audio");
      },
    });
    expect(() => sound.unlock()).not.toThrow();
    await flush();
    expect(() => sound.hits([{ delay: 0, gain: 1 }]).stop()).not.toThrow();
  });

  it("음원 파일을 읽지 못해도 오류 없이 그 소리만 나지 않는다", async () => {
    const fake = fakeAudio();
    const sound = createSound({
      clips: CLIPS,
      load: (url) => (url === "hit-a" ? Promise.reject(new Error("404")) : load(url)),
      createContext: () => fake.audio as unknown as AudioOut,
    });
    sound.unlock();
    await flush();
    sound.hits([
      { delay: 0, gain: 1 },
      { delay: 0.5, gain: 1 },
    ]);
    await flush();
    expect(fake.log.map((e) => e.clip)).toEqual(["hit-b", "hit-b"]);
  });
});
