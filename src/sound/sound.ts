/**
 * 효과음(스펙 「소리」). Web Audio 로 컵 흔드는 소리와 충돌음을 낸다.
 *
 * - 모바일 브라우저의 자동 재생 제한 때문에 오디오는 첫 굴림 탭(`unlock`)에서 만든다. 그 전에는
 *   소리를 내려 해도 아무 일도 없다. 음원 파일은 처음부터 받아 두고, 풀린 뒤에 해독한다.
 * - 음소거는 전체 소리 크기를 0 으로 하고, 음소거 동안에는 새 소리를 내지 않는다.
 * - 시각은 모두 "지금부터 몇 초 뒤"(`delay`)로 받는다. 연출의 시계와 오디오의 시계를 잇는 것은 부르는 쪽이다.
 */

/** 이 모듈이 쓰는 AudioContext 의 부분. 테스트는 가짜를 넣는다. */
export interface AudioOut {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  createGain(): GainNode;
  createBufferSource(): AudioBufferSourceNode;
}

/** 이미 시작했거나 시작할 소리. `stop(delay)` 로 그만큼 뒤에 끈다(기본은 지금). */
export interface Voice {
  stop(delay?: number): void;
}

/** 굴림 연출이 내는 소리. */
export interface RollSound {
  /** 컵 흔드는 소리를 `delay` 초 뒤부터 그칠 때까지 되풀이한다. */
  shake(delay: number): Voice;
  /** 충돌음들. 하나마다 `delay` 초 뒤에 `gain`(0~1) 크기로 울린다. */
  hits(hits: readonly { delay: number; gain: number }[]): Voice;
}

export interface Sound extends RollSound {
  /** 사용자의 탭 안에서 부른다. 오디오를 만들어 깨우고 음원을 해독한다. 두 번째부터는 깨우기만 한다. */
  unlock(): void;
  setMuted(on: boolean): void;
}

/** 소리 이름마다 음원 파일 주소들. 여러 개면 번갈아 쓴다. */
export interface SoundClips {
  shake: readonly string[];
  hit: readonly string[];
}

export interface SoundOptions {
  clips: SoundClips;
  /** 음원 파일의 바이트를 받는다. 운영은 fetch. */
  load(url: string): Promise<ArrayBuffer>;
  /** 오디오를 만든다. 쓸 수 없는 브라우저면 예외를 던져도 된다(소리 없이 계속한다). */
  createContext(): AudioOut;
}

const SILENT: Voice = { stop() {} };

/** 아무 소리도 내지 않는 효과음. 테스트와, 효과음을 넣지 않은 앱의 기본값이다. */
export const silentSound: Sound = {
  unlock() {},
  setMuted() {},
  shake: () => SILENT,
  hits: () => SILENT,
};
/** 흔드는 소리를 그칠 때 잦아드는 시간(초). */
const FADE_SECONDS = 0.08;
/** 음원을 해독하느라 늦어진 충돌음은 이만큼(초)까지만 늦게라도 울린다. 더 늦으면 건너뛴다. */
const LATE_HIT_SECONDS = 0.05;

type Kind = keyof SoundClips;
type Buffers = Record<Kind, AudioBuffer[]>;
/** 풀린 뒤의 오디오. `master` 는 전체 소리 크기(음소거), `buffers` 는 해독한 음원. */
interface Output {
  audio: AudioOut;
  master: GainNode;
  buffers: Promise<Buffers>;
}
/** 울리고 있거나 울릴 소리 하나와 그 소리 크기 노드. */
interface Playing {
  source: AudioBufferSourceNode;
  level: GainNode;
}

export function createSound({ clips, load, createContext }: SoundOptions): Sound {
  // 파일은 처음부터 받아 둔다(받기는 자동 재생 제한과 상관없다). 실패한 파일은 빠진다.
  const bytes = {
    shake: clips.shake.map((url) => load(url).catch(() => null)),
    hit: clips.hit.map((url) => load(url).catch(() => null)),
  };
  let muted = false;
  let out: Output | null = null;
  const turn = { shake: 0, hit: 0 };

  const decodeAll = async (audio: AudioOut, kind: Kind) => {
    const decoded = await Promise.all(
      bytes[kind].map(async (pending) => {
        const data = await pending;
        if (!data) return null;
        try {
          return await audio.decodeAudioData(data);
        } catch {
          return null;
        }
      }),
    );
    return decoded.filter((b): b is AudioBuffer => b !== null);
  };

  const next = (buffers: Buffers, kind: Kind) => {
    const list = buffers[kind];
    if (list.length === 0) return null;
    const buffer = list[turn[kind] % list.length] ?? null;
    turn[kind]++;
    return buffer;
  };

  /** 소리 하나를 `when`(오디오 시계)에 시작한다. */
  const play = (
    o: Output,
    buffer: AudioBuffer,
    when: number,
    gain: number,
    loop: boolean,
  ): Playing => {
    const level = o.audio.createGain();
    level.gain.value = gain;
    level.connect(o.master);
    const source = o.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(level);
    source.start(when);
    return { source, level };
  };

  /**
   * 음원 해독이 끝나면 `start` 로 소리를 시작하고, `stop` 이 불리면 끈다. 해독 전에 불린 stop 도 지킨다.
   * `start` 는 부른 때의 오디오 시각(`askedAt`)을 받아 소리들을 시작하고, 시작한 것들을 돌려준다.
   */
  const voice = (start: (o: Output, buffers: Buffers, askedAt: number) => Playing[]): Voice => {
    const o = out;
    if (!o || muted) return SILENT;
    const askedAt = o.audio.currentTime;
    let stopAt: number | null = null;
    let playing: Playing[] = [];
    const halt = (at: number) => {
      for (const { source, level } of playing) {
        try {
          level.gain.setValueAtTime(level.gain.value, at);
          level.gain.linearRampToValueAtTime(0, at + FADE_SECONDS);
          source.stop(at + FADE_SECONDS);
        } catch {
          // 이미 멈춘 소리.
        }
      }
    };
    void o.buffers.then((buffers) => {
      if (muted || (stopAt !== null && stopAt <= o.audio.currentTime)) return;
      playing = start(o, buffers, askedAt);
      if (stopAt !== null) halt(stopAt);
    });
    return {
      stop(delay = 0) {
        stopAt = o.audio.currentTime + Math.max(delay, 0);
        halt(stopAt);
      },
    };
  };

  return {
    unlock() {
      if (!out) {
        try {
          const audio = createContext();
          const master = audio.createGain();
          master.gain.value = muted ? 0 : 1;
          master.connect(audio.destination);
          const buffers = Promise.all([decodeAll(audio, "shake"), decodeAll(audio, "hit")]).then(
            ([shake, hit]) => ({ shake, hit }),
          );
          out = { audio, master, buffers };
        } catch {
          return;
        }
      }
      if (out.audio.state !== "running") void out.audio.resume().catch(() => {});
    },

    setMuted(on) {
      muted = on;
      if (out) out.master.gain.value = on ? 0 : 1;
    },

    shake(delay) {
      return voice((o, buffers, askedAt) => {
        const buffer = next(buffers, "shake");
        if (!buffer) return [];
        const when = Math.max(askedAt + Math.max(delay, 0), o.audio.currentTime);
        return [play(o, buffer, when, 1, true)];
      });
    },

    hits(list) {
      return voice((o, buffers, askedAt) => {
        const now = o.audio.currentTime;
        const started: Playing[] = [];
        for (const hit of list) {
          const when = askedAt + Math.max(hit.delay, 0);
          if (when < now - LATE_HIT_SECONDS) continue;
          const buffer = next(buffers, "hit");
          if (buffer) started.push(play(o, buffer, Math.max(when, now), hit.gain, false));
        }
        return started;
      });
    },
  };
}
