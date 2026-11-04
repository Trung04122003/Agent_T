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

## P37: codenames, HUD and flavor lines
Flavor lines (`cityQuiet*`, `cityAllLit`, `cityDropNote`) were drafted with the humanizer skill. None states a fact about the owner; `cityDropNote` describes the existing request button. Codenames name places in the city plan (lots), so they never say anything about an entry beyond its kind of building. Renamed in P37: the lot first sketched as "Embassy Row" is now "Liaison House" (no state or diplomatic connotation, DECISIONS-v4 hard limits).

| Key | vi | en | Purpose | Status |
|---|---|---|---|---|
| cityNameplate | Agent T | Agent T | HUD nameplate (the character's name, DECISIONS-v4) | draft |
| cityLotAcademy | Học viện | The Academy | District codename of lot `academy` (names the place, not the entry) | draft |
| cityLotSignalRoom | Phòng Tín hiệu | Signal Room | District codename of lot `signal-room` (names the place, not the entry) | draft |
| cityLotFoundry | Xưởng Đúc | The Foundry | District codename of lot `foundry` (names the place, not the entry) | draft |
| cityLotMarketHall | Nhà Lồng | Market Hall | District codename of lot `market-hall` (names the place, not the entry) | draft |
| cityLotObservatory | Đài Quan sát | The Observatory | District codename of lot `observatory` (names the place, not the entry) | draft |
| cityLotGlassTower | Tháp Kính | Glass Tower | District codename of lot `glass-tower` (names the place, not the entry) | draft |
| cityLotLiaisonHouse | Nhà Liên lạc | Liaison House | District codename of lot `liaison-house` (names the place, not the entry) | draft |
| cityLotLotA | Sàn Giao dịch | The Exchange | District codename of lot `lot-a` (names the place, not the entry) | draft |
| cityLotLotB | Nhà Bến | Pier House | District codename of lot `lot-b` (names the place, not the entry) | draft |
| cityLotLotC | Trạm Chuyển tiếp | Relay Yard | District codename of lot `lot-c` (names the place, not the entry) | draft |
| cityLotLotD | Nhà Góc phố | Corner House | District codename of lot `lot-d` (names the place, not the entry) | draft |
| cityLotLotE | Nhà Phụ Bắc | North Annex | District codename of lot `lot-e` (names the place, not the entry) | draft |
| cityLotLotF | Nhà Phụ Đông | East Annex | District codename of lot `lot-f` (names the place, not the entry) | draft |
| cityLotLotG | Nhà Bên Kênh | Canal House | District codename of lot `lot-g` (names the place, not the entry) | draft |
| cityLandmarkArchiveTower | Tháp Lưu trữ | Archive Tower | Landmark name: `archive-tower` (a dossier part) | draft |
| cityLandmarkDebriefRoom | Phòng Hồi báo | Debrief Room | Landmark name: `debrief-room` (a dossier part) | draft |
| cityLandmarkRiskRegistry | Phòng Sổ Rủi ro | Risk Registry | Landmark name: `risk-registry` (a dossier part) | draft |
| cityLandmarkLab | Phòng Thí nghiệm | The Lab | Landmark name: `lab` (a dossier part) | draft |
| cityLandmarkDeadDrop | Điểm thả tin | Dead Drop | Landmark name: `dead-drop` (a dossier part) | draft |
| cityLog | Nhật ký nhiệm vụ | Mission log | Heading of the mission log | draft |
| cityStateSealed | Niêm phong | Sealed | District state: not visited | draft |
| cityStateScouted | Đã dò | Scouted | District state: seen up close | draft |
| cityStateBriefed | Đã đọc | Briefed | District state: briefing opened | draft |
| cityStateDeclassified | Đã giải mật | Declassified | District state: summary read (Giai mat) | draft |
| cityNext | Mục tiêu tiếp | Next objective | Compass label | draft |
| cityLight | Mức sáng {n} trên {total} | Light level {n} of {total} | Light level, n districts lit of N (never a percent) | draft |
| cityPrompt | Mở bản tóm tắt: {name} | Open the briefing: {name} | Door prompt (with the key E) | draft |
| cityPromptDrop | Dùng điểm thả tin | Use the dead drop | Door prompt at the Dead Drop | draft |
| cityClose | Đóng | Close | Close a briefing | draft |
| cityNear | Gần {name}. | Near {name}. | Announced near a door (screen readers) | draft |
| cityQuietSealed | Khu này vẫn chưa lên đèn. | The lights on this block are still off. | Flavor, announced after the name of a district still sealed | draft |
| cityQuietLit | Khu này đã lên đèn. | This block's lights are on. | Flavor, announced after the name of a lit district | draft |
| cityAllLit | Cả thành phố đã lên đèn. | Every block in the city is lit. | Compass when every district is done | draft |
| cityDropNote | Để lại lời nhắn ở đây. Thư đi thẳng tới hộp thư công việc. | Leave a note here. It goes to the work inbox. | Dead Drop briefing: what the request button does (it opens a mail to the allowlisted work address) | draft |
| cityHint | Mũi tên: đi · E: mở · F: mục tiêu tiếp | Arrows: walk · E: open · F: next objective | Controls line in the HUD | draft |

## P39: full screen
| Key | vi | en | Purpose | Status |
|---|---|---|---|---|
| cityFullscreen | Toàn màn hình | Full screen | HUD button, PC and laptop | draft |
| cityFullscreenExit | Thoát toàn màn hình | Exit full screen | The same button while full screen | draft |

## P41: the dive into the real map
| Key | vi | en | Purpose | Status |
|---|---|---|---|---|
| cityAtlas | Bàn Atlas | The Atlas | Landmark name (HUD, screen readers) and the overlay's title | draft |
| cityPromptAtlas | Lặn vào bản đồ | Dive into the map | Prompt beside the table (with the key E) | draft |
| cityAtlasOpen | Bản đồ thật | The real map | Button under the title: opens the map at once (the Lite view's way in) | draft |
| cityAtlasBack | Về thành phố | Back to the city | Closes the map overlay | draft |
