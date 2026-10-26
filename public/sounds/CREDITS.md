# 효과음 출처

모든 음원은 freesound.org 의 2BACH 녹음이고 라이선스는 **CC0 1.0**(Creative Commons Zero, 퍼블릭 도메인 헌정)이다. 저작권 표시 의무는 없지만 출처를 남긴다. 사용자 승인(#12)을 받아 도입했다.

원본은 로그인해야 받을 수 있는 WAV 대신, 각 소리 페이지에서 로그인 없이 받을 수 있는 **Freesound HQ 미리듣기 MP3**(48 kHz, 모노)를 받아 잘랐다.

| 파일 | 원본 제목 | 작성자 | 출처 | 라이선스 | 자른 방법 |
|---|---|---|---|---|---|
| `shake.wav` | Dice (3) shake in cup | 2BACH | https://freesound.org/people/2BACH/sounds/185978/ | CC0 1.0 | 3.30~5.30초의 2초. 끝 80 ms 를 처음에 겹쳐 반복 재생해도 이음매가 없게 함 |
| `hit-1.wav`·`hit-2.wav`·`hit-3.wav`·`hit-4.wav`·`hit-5.wav` | Dice (3) slam on felt | 2BACH | https://freesound.org/people/2BACH/sounds/185977/ | CC0 1.0 | 0.17·2.90·4.50·6.17·7.81초 둘레에서 처음 펠트에 닿는 '딱' 소리 하나씩(약 40~60 ms). 다음 소리 전에 끊고 끝을 줄임 |
| `hit-6.wav`·`hit-7.wav` | Dice (6) pour on felt | 2BACH | https://freesound.org/people/2BACH/sounds/185982/ | CC0 1.0 | 3.84·12.07초 둘레의 첫 '딱' 소리 하나씩(약 30~50 ms). 자른 방법은 위와 같음 |

모두 48 kHz 16비트 모노 WAV 다. 반복 재생과 시작 시각이 정확하도록 MP3 의 앞뒤 여백이 없는 WAV 로 바꿨다. 크기는 컵 흔들기의 최고 크기를 0.6, 충돌음을 0.7 로 맞췄다. 자르기는 이 PC 에 이미 있던 ffmpeg(MP3 풀기)와 Python(numpy, 소리 크기 흐름으로 시작점 찾기)으로 했다.
