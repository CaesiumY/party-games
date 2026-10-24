// 운영 빌드 검사: `pnpm build` 결과물(dist/)에 E2E 테스트용 주사위 공급원이 들어 있지 않은지 본다.
// `pnpm check:build` 로 돌린다. 브라우저가 필요 없어 CI 에서도 돈다. 다른 폴더를 보려면 경로를 인자로 준다.
// 테스트용 빌드(`vite build --mode e2e`)를 주면 표식이 있어 실패해야 한다 — 검사가 실제로 잡는지 보는 방법이다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { E2E_DICE_SOURCE_MARKER } from "../src/engine/e2e-dice-source.ts";

const root = join(import.meta.dirname, "..");
const dir = join(root, process.argv[2] ?? "dist");

if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`운영 빌드 검사 실패: ${relative(root, dir)} 가 없다. 먼저 pnpm build 를 돌린다.`);
  process.exit(1);
}

const files = readdirSync(dir, { recursive: true, encoding: "utf8" })
  .map((name) => join(dir, name))
  .filter((path) => statSync(path).isFile());

if (!files.some((path) => path.endsWith(".js"))) {
  console.error(`운영 빌드 검사 실패: ${relative(root, dir)} 에 .js 파일이 없다.`);
  process.exit(1);
}

const hits = files.filter((path) => readFileSync(path, "latin1").includes(E2E_DICE_SOURCE_MARKER));

for (const path of hits) {
  console.error(
    `${relative(root, path)}: 테스트용 주사위 공급원의 표식 '${E2E_DICE_SOURCE_MARKER}'`,
  );
}

if (hits.length > 0) {
  console.error(
    `\n운영 빌드 검사 실패: ${hits.length}개 파일에 테스트용 주사위 공급원이 들어 있다. src/main.tsx 가 __E2E_DICE_SOURCE__ 로만 E2E 공급원을 고르는지 본다.`,
  );
  process.exit(1);
}

console.log(`운영 빌드 검사 통과: ${files.length}개 파일에 테스트용 주사위 공급원이 없다.`);
