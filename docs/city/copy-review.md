# Agent T City — copy review

Every visible city string, for the owner's approval before release (DECISIONS-v4, "Creative license"). Strings live in `content/ui.json` (keys starting with `city`), in Vietnamese and English. Flavor lines state no fact about the owner and nothing absent from `content/`.

Status: **draft** until the owner marks it **approved** (date).

| Key | vi | en | Purpose | Status |
|---|---|---|---|---|
| cityTitle | Thành phố Agent T | Agent T City | Page title and heading (name from DECISIONS-v4) | draft |
| cityBack | Về hồ sơ | Back to dossier | Link back to the dossier (UX-v4 section 1) | draft |
| cityEnter | Vào thành phố Agent T | Enter Agent T's city | Entry link under the gate's lenses and in the dossier header (UX-v4 section 1) | draft |
| citySkip | Đến thẳng hồ sơ | Straight to the dossier | Skip link, first Tab stop on the city page | draft |
| cityDistricts | Các khu trong thành phố | City districts | Heading of the district list (no-JS, screen reader, Lite) | draft |
| cityOpenInDossier | Mở trong hồ sơ | Open in the dossier | Each district's link to its ledger row (`/#claim-<id>`) | draft |
| cityVault | Kho niêm phong | The Vault | Name of the classified entry's building; followed by the entry's type label only | draft |
| cityLite | Xem bản nhẹ | Lite view | Link to the Lite view (`?lite`) | draft |
| cityLiteMap | Sơ đồ thành phố, bản nhẹ | City plan, lite view | Accessible name of the Lite plan (SVG) | draft |
| cityNoScript | Cần bật JavaScript để dạo thành phố. Danh sách dưới đây dẫn tới đủ mọi mục. | Walking the city needs JavaScript. The list below reaches every entry. | Shown only without JS | draft |
| cityPrint | Đây là thành phố tương tác. Để in, hãy mở hồ sơ: | This is the interactive city. To print, open the dossier: | The only line on a printed city page, followed by the dossier's address | draft |

Removed in P33: `cityStub` (the P31 placeholder line).
