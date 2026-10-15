# ADR 0003: Distributed Dual-Write and Out-of-Order Ingestion Resilience

## Status
Accepted

## Context
When persisting binary blobs and relational metadata across two decoupled storage tiers (Cloudflare R2 and Cloudflare D1), systems face the classic **Distributed Dual-Write Problem**:
- If D1 is written first and R2 upload times out, an orphan database record points to a missing R2 key.
- If R2 is written first and D1 fails, video data is stored without searchable metadata.

Furthermore, on mobile 4G/5G connections with high jitter and packet loss, HTTP requests can resolve out of order (e.g., Chunk 2 fails while Chunk 3 and 4 succeed). Rejecting Chunk 3 because Chunk 2 is missing would cause catastrophic data loss in life-threatening scenarios.

## Decision
1. **R2-First Dual-Write Strategy**: The Ingestion Worker writes binary data to Cloudflare R2 first. Object storage writes are naturally idempotent; repeating an upload with the same session key simply overwrites identical bytes.
2. **Atomic D1 Batch Transactions**: Metadata insertion into D1 occurs in a single atomic batch transaction (`env.WITNESS_DB.batch([...])`), ensuring the session record and chunk entry commit together.
3. **Out-of-Order Ingestion**: The Ingestion Worker never rejects sequence numbers higher than zero if sequence 0 has not yet arrived. It auto-provisions the session in an `ACTIVE` state so no footage is discarded.
4. **Write-Once Idempotency**: Each chunk computes a SHA-256 hash. If an already recorded chunk is received again during network retransmission, the worker responds with `409 Conflict`, signaling the client that the fragment is safely persisted.

## Consequences
- **Positive:** Zero orphan database records.
- **Positive:** Resilient against mobile carrier packet reordering and temporary drops.
- **Positive:** Tamper-evident proof of video integrity for forensic evidence.
