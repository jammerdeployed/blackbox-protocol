# Security Architecture & Vulnerability Disclosure

Blackbox Protocol is engineered for high-threat environments where physical devices may be confiscated, destroyed, or subjected to adversarial network conditions.

---

## 🔒 Security Guarantees & Threat Model

| Threat | Mitigation Mechanism |
| :--- | :--- |
| **Physical Device Seizure / Smashed Phone** | Sub-second fMP4 fragmentation. Chunks are dispatched in 1-second timeslices via HTTP/2 PUT; evidence is safely remote before device can be destroyed. |
| **Tampering with Video Evidence** | Cryptographic SHA-256 verification computed on-device and strictly re-verified on Cloudflare Edge before committing to R2. |
| **Overwriting or Rewriting History** | Write-Once immutability in D1 (`ON CONFLICT DO NOTHING`). Mismatched hashes on existing sequence numbers are rejected with HTTP 422 Unprocessable Entity. |
| **Memory Exhaustion (DoS)** | Edge streaming uses web `TransformStream` with constant $O(1)$ RAM ($\le 300\text{ KB}$), preventing Cloudflare worker OOM crashes. |
| **Signal Jammers / 4G Packet Loss** | Persistent IndexedDB queue with Web Locks API (`navigator.locks`) and exponential backoff retry. |
| **OS Sleep / App Backgrounding** | `visibilitychange` & `pagehide` listeners fire emergency 200-byte telemetry beacons via `navigator.sendBeacon`. |

---

## 🛡️ Supported Versions

| Version | Supported |
| :--- | :--- |
| `0.1.x` (Current Main) | ✅ Active Security Updates |
| `< 0.1.0` (Legacy prototype) | ❌ Deprecated |

---

## 🚨 Reporting a Vulnerability

We take the security and integrity of Blackbox Protocol seriously. If you discover a security vulnerability or cryptographic flaw:

1. **Do NOT open a public GitHub issue.**
2. Send a report via GitHub Security Advisories:
   [https://github.com/jammerdeployed/blackbox-protocol/security/advisories/new](https://github.com/jammerdeployed/blackbox-protocol/security/advisories/new)
   Or contact the maintainer directly via GitHub profile.
3. Include:
   - Clear description of the vulnerability
   - Proof of Concept (PoC) or reproduction steps
   - Potential impact on recorded evidence integrity or client anonymity
4. We aim to acknowledge reports within **48 hours** and provide an edge patch or release within **7 days**.
