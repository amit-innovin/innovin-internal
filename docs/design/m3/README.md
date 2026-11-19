# Material 3 prototype snapshot

The build reference for the Material 3 rebuild (branch `m3-foundation-home` and later stages).

- Canvas: https://claude.ai/artifact/NRpZBjTSvvoWB2yJNuTy7e (pages "Member app" and "Admin app"; created 19 Nov 2026 because the first canvas, DFhALZi4uN4Sxm7ng8CGN6, and the rationale page are no longer reachable)
- Snapshot taken: 19 Nov 2026. The canvas boards are published from these files; re-read the canvas before planning a stage.

| File | What it is |
|---|---|
| `Prototype.dc.html` | Phone prototype (390×844), one artboard with shared state |
| `DesktopPrototype.dc.html` | Desktop prototype (responsive page) |
| `canvas.json` | Canvas index, including the rationale notes for each decision |

| Screen | Route | Stage |
|---|---|---|
| Home | `/` | 1 (foundation + Home) |
| Days | `/days` | 2 |
| Feed (+ important announcement sheet) | `/feed` | 3 |
| Tea & snacks | `/snacks` | 4 |
| Account, Notifications, Wi-Fi check, 10K steps | `/account`, `/notifications`, `/wifi`, `/steps` | 5 |
| Speak up | `/grievances` | 6 |
| Say hi (gestures and invites) | Home crowd cards, Notifications | 7 |
| Admin app (`M3AdminApp`, `M3AdminAppPhone`) | `/admin/*` | 8 |
| Event details, Help, Sign in (`M3EventDetails`, `M3Help`, `M3SignIn`); admin event Edit + Details | `/feed/events/[id]`, `/help`, `/sign-in`, `/admin/publish` | 9 |

The Reading list is out of the design for now: no navigation entry points.
