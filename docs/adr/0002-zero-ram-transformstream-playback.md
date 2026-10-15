# ADR 0002: Zero-RAM O(1) Edge Streaming with Web TransformStream

## Status
Accepted

## Context
Cloudflare Workers operate inside V8 isolates with a hard memory ceiling of **128 MB RAM**. 
A 2-minute 1080p recording at 2.5 Mbps produces ~37.5 MB of binary video data. Naive implementations that accumulate chunks in memory (e.g., `buffers: Uint8Array[]` followed by `fullVideo = new Uint8Array(totalLength)`) duplicate the entire dataset in RAM, causing instant Out-Of-Memory (OOM) 500 errors on the edge.

Furthermore, reading dozens of R2 chunks into an in-memory array before emitting the HTTP response header causes unacceptable Time-To-First-Byte (TTFB) latency.

## Decision
We implement a zero-buffering $O(1)$ streaming pipeline in the Playback Worker using web standards (`TransformStream` and `ReadableStream`):
1. The worker queries D1 for chunk metadata (`byte_length`, `r2_key`, `sequence_num`). The response metadata consumes less than 2 KB of memory.
2. The total `Content-Length` is calculated via SQL summation (`SUM(byte_length)`).
3. A `TransformStream` writer pumps R2 chunk bodies sequentially into the HTTP response stream.
4. The worker isolate holds at most **one single 1-second chunk (~300 KB)** in memory at any point in time, regardless of whether the video is 10 seconds or 2 hours long.

## Consequences
- **Positive:** Immune to V8 isolate memory limits (constant $O(1)$ RAM complexity).
- **Positive:** Near-instantaneous Time-To-First-Byte (TTFB); playback begins as soon as Chunk 0 is retrieved.
- **Negative:** Full HTTP Range seeking across arbitrary byte offsets requires range-slicing logic across chunk boundaries (partially mitigated by the MSE manifest endpoint `/manifest`).
