# Licences of third-party data and assets

Checked on 2026-10-25 (ROADMAP 6.1).

## Map data: Natural Earth

- **Dataset:** Admin 0 – Countries, Viet Nam point of view, 1:10m (`ne_10m_admin_0_countries_vnm.geojson`).
- **Source:** official repository <https://github.com/nvkelso/natural-earth-vector> (homepage <https://www.naturalearthdata.com/>), release v5.1.2, commit `9380cca83db5f9aef52d5e762765100745f84b27`.
- **File:** 13,221,654 bytes, SHA-256 `90067c7f246a7e85a5d501b8f3d7367ad2287816c85ebd8d44634600caf26b64`. Downloaded by `scripts/fetch-map-data.mjs` into `data/` (git-ignored). Only the derived, cropped TopoJSON is committed.
- **Terms** (<https://www.naturalearthdata.com/about/terms-of-use/>): all Natural Earth data is in the public domain. Personal, educational and commercial use, modification and redistribution are allowed. Credit is not required; "Made with Natural Earth" is suggested. No warranty of accuracy. The terms say nothing specific about disputed areas.
- **Hoang Sa and Truong Sa:** in this point-of-view file both archipelagos are part of the Viet Nam (`VNM`) feature, so no extra feature was added.

**Conclusion: use allowed.** No attribution required. Whether to show "Made with Natural Earth" is the owner's choice.

## Fonts

| Package | Version | Licence |
|---|---|---|
| `@fontsource/be-vietnam-pro` | 5.3.0 | SIL Open Font License 1.1 |
| `@fontsource/ibm-plex-mono` | 5.3.0 | SIL Open Font License 1.1 |

Self-hosted under the OFL, which allows embedding in websites. The fonts may not be sold on their own.
