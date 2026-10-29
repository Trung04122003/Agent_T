# Licences of third-party data and assets

Checked on 2026-10-25 (ROADMAP 6.1).

## Map data: Natural Earth

- **Dataset:** Admin 0 – Countries, Viet Nam point of view, 1:10m (`ne_10m_admin_0_countries_vnm.geojson`).
- **Source:** official repository <https://github.com/nvkelso/natural-earth-vector> (homepage <https://www.naturalearthdata.com/>), release v5.1.2, commit `9380cca83db5f9aef52d5e762765100745f84b27`.
- **File:** 13,221,654 bytes, SHA-256 `90067c7f246a7e85a5d501b8f3d7367ad2287816c85ebd8d44634600caf26b64`. Downloaded by `scripts/fetch-map-data.mjs` into `data/` (git-ignored). Only the derived, cropped TopoJSON is committed.
- **Terms** (<https://www.naturalearthdata.com/about/terms-of-use/>): all Natural Earth data is in the public domain. Personal, educational and commercial use, modification and redistribution are allowed. Credit is not required; "Made with Natural Earth" is suggested. No warranty of accuracy. The terms say nothing specific about disputed areas.
- **Hoang Sa and Truong Sa:** in this point-of-view file both archipelagos are part of the Viet Nam (`VNM`) feature, so no extra feature was added.
- **Provinces (added 2026-10-29):** Admin 1 – States, Provinces, 1:10m (`ne_10m_admin_1_states_provinces.geojson`), same commit; 40,726,851 bytes, SHA-256 `22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5`. Same terms. Only Viet Nam's 63 mainland provinces are kept (ISO 3166-2 code only; names come from `content/provinces.json`). This file has no Viet Nam point of view: it files Hoang Sa and Truong Sa under other countries, so those features are never used; the islands still come from the admin 0 file above. Three units carry region names in the file (VN-39, VN-53, VN-66); the code and `gn_name` identify them as Dong Nai, Bac Kan and Hung Yen.

**Conclusion: use allowed.** No attribution required. Whether to show "Made with Natural Earth" is the owner's choice.

## Fonts

| Package | Version | Licence |
|---|---|---|
| `@fontsource/be-vietnam-pro` | 5.3.0 | SIL Open Font License 1.1 |
| `@fontsource/ibm-plex-mono` | 5.3.0 | SIL Open Font License 1.1 |

Self-hosted under the OFL, which allows embedding in websites. The fonts may not be sold on their own.

## Flags (ROADMAP 10.1)

| File | Flag | Source |
|---|---|---|
| `src/assets/flags/vn.svg` | Viet Nam | Drawn for this project: 3:2 red field (#da251d), five-point yellow star centred, outer radius 1/5 of the length. |
| `src/assets/flags/gb.svg` | United Kingdom (for English) | Drawn for this project from the standard 1:2 Union Flag construction (blue #012169, white, red #c8102e, counterchanged saltire). |

No third-party flag set or icon package is used, so no licence applies beyond the flags themselves. National flags are state symbols, not copyrighted works; they are used here only to label a language. Emoji flags are not used (Windows does not render them). Which flag stands for English (UK or US) is the owner's decision (DECISIONS.md: UK).
