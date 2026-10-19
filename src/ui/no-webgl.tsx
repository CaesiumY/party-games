/** WebGL 을 쓸 수 없는 기기의 안내. 2D 대체 화면은 만들지 않는다(스펙 「WebGL 미지원」). */
export function NoWebGL() {
  return (
    <main className="no-webgl">
      <p role="alert">이 기기에서는 3D를 지원하지 않습니다.</p>
    </main>
  );
}
