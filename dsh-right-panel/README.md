# dsh-right-panel

Right-side **file browser + SCM** and a bottom **mini terminal** for the DSH
Web UI, built on the `dsh-panels-framework` shells:

- **Files** (right): file tree with search, text/image preview.
- **Changes** (right): real git status with stage / unstage / discard.
- **Terminal** (bottom): run commands in the harness directory (`cd`
  supported) via the desktop client's local API.
- Header **◧ ◨ ▤** buttons: one-click collapse/expand the right panel and the
  bottom terminal.

Backend: the local DshDesktop.exe API (`/api/fs/*`, `/api/git/*`,
`/api/shell/*`).