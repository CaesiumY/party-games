/**
 * 이 브라우저가 3D 를 그릴 수 있는지. 앱을 시작할 때 한 번 본다.
 * three.js 의 렌더러는 WebGL 2 만 쓰므로(r163 부터 WebGL 1 지원 없음) WebGL 2 가 있어야 한다.
 */
export function hasWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}
