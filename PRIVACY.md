# Privacy Policy & Sovereign Data Architecture

> **Last Updated:** October 2026  
> **Applies To:** Blackbox Protocol (Client PWA & Cloudflare Edge Infrastructure)

Blackbox Protocol is an open-source, tamper-evident emergency incident witness tool designed for activists, journalists, and private individuals. The architecture is built on the principle of **Zero-Knowledge Sovereign Telemetry**: your data belongs exclusively to you and your designated emergency contacts.

---

## 🛡️ 1. Core Principles

- **Zero Third-Party Analytics:** We do not include Google Analytics, Sentry, Mixpanel, Meta Pixels, or any tracking SDKs.
- **Single-Tenant / Self-Hostable:** All edge infrastructure (Workers, R2 buckets, D1 databases) is deployed inside **your own** Cloudflare account. The developers have zero access to your video chunks, encryption keys, or GPS coordinates.
- **Client-Side Data Storage:** Authorization tokens and server URLs are stored strictly on your device via browser `localStorage`. They are never sent to any central registry.

---

## 📷 2. Device Permissions & Sensor Telemetry

When recording is initiated, the application requests access to the following browser capabilities:

### Camera & Microphone
- **Purpose:** Capture real-time audiovisual evidence of hostile incidents.
- **Operation:** Audio and video streams are encoded locally on-device into 1-second fragmented MP4 (fMP4) or WebM containers.
- **Retention:** Video fragments are saved temporarily in client IndexedDB only until verified as safely uploaded to your private Cloudflare R2 bucket.

### Geolocation (GPS)
- **Purpose:** Tag incident video fragments with geographical coordinates for legal verification and emergency dispatch.
- **Operation:** High-accuracy GPS coordinates (`latitude`, `longitude`, `accuracy`) are attached to HTTP upload headers (`X-Latitude`, `X-Longitude`).
- **Emergency Dispatch:** GPS coordinates are packaged into emergency alert payloads sent to your configured Telegram bot or Discord webhook.

---

## ☁️ 3. Cloud Storage & Edge Lifecycle

- **Binary Video Storage (Cloudflare R2):** 1-second fragments are stored under immutable keys (`sessions/<sessionId>/chunk_<sequence>.mp4`). Storage is Write-Once, Read-Many (WORM).
- **Metadata Database (Cloudflare D1):** SQLite database records session states (`ACTIVE`, `INTERRUPTED`, `COMPLETED`), fragment hashes, and heartbeat timestamps.
- **Data Deletion:** Because you own the Cloudflare account, you maintain full control to prune or delete sessions and R2 objects at any time.

---

## 🚨 4. Emergency Notification Channels

When a recording begins (Chunk 0), alert payloads are dispatched strictly to the channels **you** configure in the Settings modal:

- **Discord:** Direct webhook dispatch containing session ID, timestamp, GPS maps link, and playback URL.
- **Telegram:** Bot API dispatch (`sendLocation` and `sendMessage`) directly to your specified `chat_id`.
- **Email (Resend):** Optional transactional incident report sent to your designated emergency contact.

No alerts are transmitted to any other party.

---

## 📜 5. Compliance & Local Storage (GDPR / CCPA)

Under GDPR (Art. 6 & Art. 9) and international privacy frameworks:
- **Data Controller:** The user deploying and operating the Blackbox Protocol instance is the sole data controller.
- **Right to Erasure:** Users can purge local cache instantly using the in-app "Clear history" button, and wipe remote buckets directly via the Cloudflare dashboard or Wrangler CLI.

---

## 📬 6. Contact & Open Source Auditing

The complete source code of Blackbox Protocol is open for independent cryptographic and security auditing:  
GitHub: [https://github.com/jammerdeployed/blackbox-protocol](https://github.com/jammerdeployed/blackbox-protocol)
