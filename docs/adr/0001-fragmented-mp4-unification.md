# ADR 0001: Fragmented MP4 (fMP4) Cross-Platform Unification

## Status
Accepted

## Context
Blackbox Protocol is designed for emergency situations where video and audio must survive physical device destruction and packet loss. Traditional video recording schemes write container index atoms (`moov`) only after recording stops, rendering files unplayable if a phone is smashed or lost mid-recording.

Historically, browsers supported fragmented recording differently:
- Chrome recorded into WebM (`video/webm;codecs=vp8/vp9,opus`), which iOS Safari cannot play natively without third-party transcoders or heavy WASM decoders.
- iOS Safari recorded into Fragmented MP4 (`video/mp4;codecs=avc1,mp4a`).

With **Chrome 126+ (2024)**, Chromium added native container support for `video/mp4` with H.264 video.

## Decision
We enforce a prioritized container selection policy on the client:
1. `video/mp4;codecs="avc1.42E01E, mp4a.40.2"` (Primary target for iOS and modern Chromium)
2. `video/mp4;codecs="avc1.42E01E, opus"` (Chromium MP4 fallback)
3. `video/mp4` (Generic MP4)
4. `video/webm;codecs="vp8, opus"` (Legacy fallback)

## Consequences
- **Positive:** Unifies 95%+ of mobile traffic on Fragmented MP4 (fMP4 / CMAF compatible streams).
- **Positive:** Zero server-side transcoding costs. Emergency links sent via Telegram and Discord play directly on iOS Safari and Android Chrome without dedicated media servers.
- **Negative:** Legacy devices without MP4 `MediaRecorder` support fall back to WebM, requiring MSE/WASM playback for cross-device viewing.
