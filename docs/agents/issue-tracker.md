# Issue tracker: GitHub

Issues for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Specs live in the repo

스펙은 GitHub 이슈가 아니라 저장소 파일 `docs/specs/<feature>.md` 가 원본이다. 스펙을 바꿀 때는 PR 로 검토한다.

- 기능마다 **상위 이슈** 하나를 둔다. 본문은 스펙 파일로 연결만 하고 스펙 내용을 복사하지 않는다.
- 티켓은 상위 이슈의 **하위 이슈**(sub-issue)로 만들고, 선행 관계는 아래 **Blocking** 의 GitHub 기본 기능으로 건다.
- 같은 기능의 이슈는 기능 이름의 마일스톤(예: `요트 MVP`)으로 묶는다.
- `/to-spec` 이 "publish to the issue tracker" 라고 하면: 스펙을 `docs/specs/<feature>.md` 로 쓰고 PR 을 연 뒤, 그 파일로 연결하는 상위 이슈를 만든다.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --limit 1000 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters. Keep `--limit`: `gh issue list` returns only 30 issues by default.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone. In a fork clone, run `gh repo set-default <upstream-owner>/<repo>` once so every `gh` command targets the upstream repo, not the fork.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. For a spec, follow **Specs live in the repo** above.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Labels (first run)**: the map and child labels are not created by setup. Before the first map, create any that are missing: `for l in wayfinder:map wayfinder:research wayfinder:prototype wayfinder:grilling wayfinder:task; do gh label list --search "$l" --json name --jq '.[].name' | grep -qx "$l" || gh label create "$l"; done`.
- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: read the map's complete sub-issue list through the REST API, which carries the blocker count on each child and is paginated so no child is dropped: `gh api --paginate "repos/<owner>/<repo>/issues/<map>/sub_issues?per_page=100" --jq '.[] | select(.state=="open" and (.issue_dependencies_summary.blocked_by // 0)==0 and (.assignees|length)==0) | .number'`. The output keeps map order; the first number wins. A child without a dependency summary counts as 0 here, so the body `Blocked by:` check below still decides it. (`gh issue list` caps at 30 results by default and its `--json` fields may not expose blockers, so it is not used here.) Then also drop any child whose body has a `Blocked by:` line naming an open issue (the fallback when native dependencies are unavailable). For a task-list map without sub-issues, use the task list in place of the sub-issue list.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
