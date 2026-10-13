## Agent skills

### Issue tracker

이슈는 로컬 마크다운(`.scratch/<feature>/`)으로 관리한다. See `docs/agents/issue-tracker.md`.

### PR review bot

Codex 는 PR 을 열 때와 `@codex review` 댓글에만 검토한다. 새 커밋을 올린 뒤 "봇이 통과시켰다"고 판단하려면 `@codex review` 로 재검토를 받고, 검토한 커밋 해시가 최신인지 확인한다.

### Triage labels

기본 5개 라벨(`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)을 그대로 쓴다. See `docs/agents/triage-labels.md`.

### Domain docs

single-context: 루트의 `GLOSSARY.md` 하나 + `docs/adr/`. See `docs/agents/domain.md`.
