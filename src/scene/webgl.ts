/** 이 브라우저가 WebGL 로 3D 를 그릴 수 있는지. 앱을 시작할 때 한 번 본다. */
export function hasWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
