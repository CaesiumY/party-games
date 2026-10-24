# 글꼴 서브셋

`public/fonts/` 의 woff2 는 원본 TTF(네이버 공식 배포 나눔스퀘어라운드 B·EB, google/fonts 의 M PLUS Rounded 1c Medium·ExtraBold, 저장소 밖에 둠)에서 `chars-ui.txt`·`chars-num.txt` 의 글자만 남긴 것이다. `pip install fonttools brotli` 뒤 `python scripts/fonts/subset.py <원본 TTF 폴더>` 로 글자 목록과 woff2 를 다시 만든다(원본 주소와 이름을 바꾸는 이유는 `subset.py` 머리 주석).
