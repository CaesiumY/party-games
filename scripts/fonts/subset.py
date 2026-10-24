"""글꼴 서브셋: 원본 TTF 에서 쓰는 글자만 남겨 public/fonts/ 에 woff2 로 쓴다(DESIGN.md 「Typography」).

필요: Python 3 + fonttools + brotli (`pip install fonttools brotli`). 저장소 의존성이 아니다.
원본(저장소에 넣지 않음):
  - 나눔스퀘어라운드 B·EB: 네이버 공식 배포
    https://hangeul.pstatic.net/hangeul_static/webfont/zips/nanum-square-round.zip
  - M PLUS Rounded 1c Medium·ExtraBold: google/fonts 저장소 ofl/mplusrounded1c/
실행: python scripts/fonts/subset.py <원본 TTF 폴더>
글자 목록: scripts/fonts/chars-ui.txt(한글 글꼴), scripts/fonts/chars-num.txt(숫자 글꼴). 이 스크립트가
src 의 화면 문구 + KS X 1001 상용 한글 2,350자 + 기본 라틴으로 다시 만든다.

나눔스퀘어라운드는 OFL 의 예약 글꼴 이름(Reserved Font Name)이 있어서, 줄인 수정본은 그 이름을 쓸 수 없다.
그래서 이름을 「Yacht Round」로 바꿔 쓴다. M PLUS Rounded 1c 는 예약 이름이 없어 그대로 둔다.
"""

import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "fonts"
HERE = ROOT / "scripts" / "fonts"

BASIC_LATIN = "".join(chr(c) for c in range(0x20, 0x7F))

# (원본 파일, 출력 파일, 글자 목록, 새 글꼴 이름 또는 None, 굵기 이름)
FONTS = [
    ("NanumSquareRoundB.ttf", "yacht-round-700.woff2", "chars-ui.txt", "Yacht Round", "Bold"),
    ("NanumSquareRoundEB.ttf", "yacht-round-800.woff2", "chars-ui.txt", "Yacht Round", "ExtraBold"),
    ("MPLUSRounded1c-Medium.ttf", "mplus-rounded-1c-500.woff2", "chars-num.txt", None, None),
    ("MPLUSRounded1c-ExtraBold.ttf", "mplus-rounded-1c-800.woff2", "chars-num.txt", None, None),
]


def ks_x_1001_hangul() -> str:
    """KS X 1001(EUC-KR) 의 상용 한글 2,350자: 0xB0A1 ~ 0xC8FE."""
    chars = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            chars.append(bytes([hi, lo]).decode("euc-kr"))
    return "".join(chars)


def ui_text_chars() -> str:
    """화면 코드(테스트 제외)와 index.html 에 적힌, 아스키가 아닌 모든 글자."""
    files = [ROOT / "index.html"] + [
        p
        for p in (ROOT / "src").rglob("*")
        if p.suffix in {".ts", ".tsx"} and not re.search(r"\.test\.tsx?$", p.name)
    ]
    found = set()
    for path in files:
        found.update(c for c in path.read_text(encoding="utf-8") if ord(c) > 0x7E)
    return "".join(sorted(found))


def write_lists() -> None:
    ui = sorted(set(BASIC_LATIN + ks_x_1001_hangul() + ui_text_chars()))
    (HERE / "chars-ui.txt").write_text("".join(ui) + "\n", encoding="utf-8", newline="\n")
    (HERE / "chars-num.txt").write_text(BASIC_LATIN + "\n", encoding="utf-8", newline="\n")


def rename(font: TTFont, family: str, style: str) -> None:
    """이름 표의 글꼴 이름을 바꾼다(저작권·라이선스 줄은 그대로). 원본의 한국어 이름 기록도 지운다."""
    names = {
        1: family,
        2: style,
        3: f"{family} {style}",
        4: f"{family} {style}",
        6: f"{family.replace(' ', '')}-{style}",
        16: family,
        17: style,
    }
    table = font["name"]
    for record in list(table.names):
        if record.nameID in names:
            table.removeNames(nameID=record.nameID)
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("사용법: python scripts/fonts/subset.py <원본 TTF 폴더>")
    src = pathlib.Path(sys.argv[1])
    write_lists()
    OUT.mkdir(parents=True, exist_ok=True)
    for source, target, chars, family, style in FONTS:
        text = (HERE / chars).read_text(encoding="utf-8").rstrip("\n")
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "tnum"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.hinting = False
        font = subset.load_font(str(src / source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        if family and style:
            rename(font, family, style)
        subset.save_font(font, str(OUT / target), options)
        print(f"{target}: {(OUT / target).stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
