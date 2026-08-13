# dsh-live-stats

Real-time **token statistics** for the DSH Web UI. A compact line under each
completed turn (via the `conversation.chat.turnTail` chain) shows:

- TPS (tokens per second during decode)
- LLM wall time
- Input / output tokens
- Cache-hit tokens (when the provider reports them)

All values are computed client-side from the conversation snapshot
(`node.usage` / `node.timing`), so no extra backend is needed.