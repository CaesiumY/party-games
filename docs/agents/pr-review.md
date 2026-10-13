# PR Review Bot

이 저장소의 PR은 Codex(`chatgpt-codex-connector`)가 자동으로 검토한다.

## 언제 검토하는가

Codex는 PR을 열 때, 초안을 정식 PR로 바꿀 때, `@codex review` 댓글이 달릴 때만 검토한다. 새 커밋을 올려도 저절로 다시 검토하지 않는다.

## "봇이 통과시켰다"의 판단

- 통과 신호는 두 가지다: PR에 👍 반응, 또는 "Didn't find any major issues" 댓글.
- 그 신호가 가리키는 **검토한 커밋 해시가 PR의 최신 커밋과 같아야** 통과로 본다. 다르면 `@codex review` 댓글로 재검토를 요청한 뒤 다시 확인한다.
- `@codex review` 댓글은 공개 PR에 글을 남기는 일이라, 사용자가 요청했거나 승인했을 때만 단다.
