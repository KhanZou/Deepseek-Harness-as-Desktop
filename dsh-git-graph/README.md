# dsh-git-graph

A **Git Graph** conversation view tab for the DSH Web UI (beside Chat /
Trajectory). Shows a branch selector, a checkout button, and a commit-history
**swimlane graph** (dots + lane lines + merge connectors). Backed by the local
DshDesktop.exe git API (`/api/git/branches|log|checkout`), operating on the
harness working directory (`serverWorkDir`).