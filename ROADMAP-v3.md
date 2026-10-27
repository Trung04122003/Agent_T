# ROADMAP v3 — P20 đến P30

Áp dụng sau khi P0–P19 đã xong. **P20 cũ (phát hành) được đổi thành P30.** Bổ sung cho `ROADMAP.md` và `ROADMAP-v2.md`; các quy tắc ở đó vẫn có hiệu lực. Thiết kế: `UX-v3.md`. Quyết định của chủ dự án: `DECISIONS-v3.md`. Đo hiệu năng: `docs/performance-playbook.md`.

## Quy tắc riêng của v3
1. Mỗi phiên làm đúng một phase, theo từng dòng `step -> verify`, dừng ở Checkpoint chờ chủ dự án.
2. **Không tự viết nội dung** (dòng định vị, AAR, rủi ro, số liệu, câu chữ về người thật). `null` thì ẩn khối đó và liệt kê câu hỏi. Chuỗi giao diện (nhãn nút, chú thích) thì được dựng, nhưng phải có cả vi và en.
3. **Đo trước, tối ưu sau.** Mọi thay đổi liên quan hiệu năng phải có số trước/sau trong `docs/perf-log.md`, đo trên bản `build:prod` + preview, không đo trên `pnpm dev`.
4. Hiệu ứng liên quan con trỏ, cổng, chuyển cảnh chỉ chạy khi thiết bị phù hợp (xem `UX-v3.md` mục 1) và phải có đường thoái lui không hiệu ứng.
5. Thêm thư viện mới (kể cả devDependency) phải hỏi chủ dự án trước, ghim phiên bản, ghi giấy phép.
6. Không dùng logo/huy hiệu cơ quan thật; không số liệu giả; không ngụ ý hiệu suất đầu tư.
7. Cuối mỗi phase: `pnpm typecheck && pnpm test && pnpm build:prod && pnpm check:leaks`, đọc kết quả, chụp ảnh 375px và 1280px ở hai chế độ.
8. Không commit, push, deploy trừ khi chủ dự án yêu cầu.

---

## P20 — Sửa lỗi sau đánh giá 27/10

| # | Step | Verify |
|---|---|---|
| 20.1 | BBE (Mật) đang hiện hai câu gần trùng (BLUF và teaser). Quy tắc: nếu có `bluf` thì Mật hiện BLUF và **không** hiện teaser; teaser chỉ hiện khi không có BLUF. | Test Ledger; ảnh Mật |
| 20.2 | Thêm cờ `paused: true`. Mục tạm dừng: không hiện thời lượng ("16 THÁNG") mà hiện "tạm dừng"; không tính vào "đang diễn ra" và vào biểu đồ cam kết (loại ra hoặc vẽ nhạt). Áp cho Bluesea. | Unit test thời lượng, đếm, biểu đồ |
| 20.3 | Khối số liệu đầu trang: bỏ ô "7 mục trong sổ" và "5 năm trong hồ sơ" (đo cuốn sổ, không đo thành quả). Giữ ô phân bố bậc bằng chứng. Thêm `metrics` tùy chọn trong `content/` (nhãn, giá trị, đơn vị, mã mục nguồn) do chủ dự án cung cấp; rỗng thì không hiện ô nào ngoài bậc bằng chứng. **Không tự điền số.** | Test; mọi ô truy được về `content/` |
| 20.4 | Bản đồ: bỏ dòng chú thích dài khỏi bản đồ (chỉ để ở danh sách bên phải); quy tắc tránh chồng nhãn (Đà Nẵng / Điện Bàn / Thái Nguyên / Thường Tín); viền chữ (`paint-order: stroke`) để nhãn đọc được trên nền; Giải mật tô Việt Nam khác các nước láng giềng. | Ảnh 375/1280, hai chế độ; không nhãn nào chồng nhau |
| 20.5 | Khung chân dung ở Giải mật trống xám: dùng ống ngắm giữ chỗ như Mật, hoặc ẩn cột ảnh khi chưa có ảnh thật. | Ảnh Giải mật |
| 20.6 | Chú giải T1/T2/T3 ở Mật: dùng cùng ký hiệu thanh như Giải mật, xếp thành lưới 3 cột (1 cột ở 375px), không tràn một dòng dài. | Ảnh 375/1280 |
| 20.7 | Đo tác động của chuyển `grid-template-rows` (mở/đóng dòng sổ cái) lên khung hình, vì đây là hoạt ảnh làm bố cục chạy lại mỗi khung, trái với quy tắc "chỉ transform/opacity/clip-path". Nếu vượt ngưỡng ở `docs/performance-playbook.md`, thay bằng phương án không đụng bố cục. | Số liệu trong `docs/perf-log.md` |
| 20.8 | **Không đụng** vào dòng định vị đầu trang, AAR, "Giới hạn và rủi ro": chỉ liệt kê vấn đề (xem `DECISIONS-v3.md`) để chủ dự án tự viết. Prudential vẫn `hold`. | Báo cáo |

**Checkpoint P20:** chủ dự án duyệt ảnh.

## P21 — Con trỏ: nền tảng
Thiết kế: `UX-v3.md` mục 1.

| # | Step | Verify |
|---|---|---|
| 21.1 | Tạo 4 ảnh con trỏ SVG, mỗi ảnh ≤ 32×32 px, có `width`/`height` rõ ràng, điểm nóng (hotspot) đúng tâm: Mật mặc định, Mật mục tiêu (to hơn, đã xoay 45°), Giải mật mặc định (chữ thập mảnh + ô vuông nhỏ), Giải mật mục tiêu. **Mỗi ảnh có viền tương phản 1 px** để nhìn thấy cả trên thanh che đen, dải đồng và nền sáng. | Mở thử trên Edge/Chrome/Firefox Windows: thấy cả trên nền đen, nền sáng, dải đồng |
| 21.2 | CSS `cursor: url(...) x y, <từ khóa dự phòng>` (từ khóa dự phòng bắt buộc ở cuối). Quy tắc riêng cho từng `[data-mode]` vì `url()` không dùng được biến CSS. Không dùng `cursor: none`. | Test: computed `cursor` chứa `url(` khi `(hover:hover) and (pointer:fine)`; không chứa khi `data-cursor="system"` |
| 21.3 | Điều kiện: chỉ áp khi `(hover: hover) and (pointer: fine)`. Chữ để chọn giữ con trỏ `text`; ô nhập giữ nguyên. | Playwright với `hasTouch`: không áp |
| 21.4 | Lưu tùy chọn `cursorFx` (`custom`/`system`) trong `localStorage` (bọc try/catch), thuộc tính `data-cursor` trên `:root`, script chống nháy trước paint. Nút bật/tắt đặt ở bảng "Aa" (P27); trong phase này tạm có công tắc trong dev. | Test lưu/đọc; render đúng khi `localStorage` bị chặn |

## P22 — Con trỏ: vòng và khung chọn
| # | Step | Verify |
|---|---|---|
| 22.1 | **Mật:** vòng ống ngắm bằng đồng thau, bám theo chuột với độ trễ nhẹ (nội suy ~0.3, dừng khi gần tới nơi). Khi qua phần tử có `data-cursor-target` (nút, tiêu đề dòng, liên kết, cờ, lens, biểu đồ): vòng phóng 1.4 lần và xoay 45° trong 180 ms (`transform` thôi). | Playwright: kiểm `transform` đổi khi hover |
| 22.2 | **Giải mật:** không có vòng bám theo. Thay bằng **khung chọn**: một phần tử duy nhất, bốn góc, trượt bằng `transform` tới phần tử đang hover (kiểu khung chọn trên màn hình giao dịch), kèm đường gạch chân đồng thau quét bằng `clip-path` ở dòng sổ cái. | Playwright; ảnh |
| 22.3 | Hiệu năng: một vòng `requestAnimationFrame` duy nhất; `pointermove` ở chế độ passive, chỉ ghi tọa độ; không đọc layout trong vòng lặp; đo hình chữ nhật của mục tiêu **một lần** khi `pointerenter` (và khi `ResizeObserver` báo đổi); dừng vòng lặp khi chuột đứng yên 600 ms, chạy lại khi di chuyển; ẩn khi `visibilitychange`/`blur`/chuột rời cửa sổ; `will-change: transform` chỉ trên phần tử vòng/khung. | Bài đo khung hình ở `docs/performance-playbook.md` qua ngưỡng |
| 22.4 | Điều kiện kích hoạt: `(hover:hover) and (pointer:fine)` **và** `prefers-reduced-motion: no-preference` **và** `data-cursor != system`. Không đủ điều kiện thì **không nạp mã** (kiểm tra trước khi import). Chỉ phản hồi `pointerType === "mouse"`. Phần tử vòng/khung có `aria-hidden`, `pointer-events: none`, không che vòng focus bàn phím. | Test: không đủ điều kiện thì không có phần tử vòng trong DOM |

## P23 — Biểu đồ: đường chữ thập
| # | Step | Verify |
|---|---|---|
| 23.1 | Giải mật: đường dọc dính vào từng tháng + đường ngang theo giá trị, kèm khung đọc số (ngày, số cam kết) ở trục, kiểu màn hình giao dịch. Mật: cùng đường chữ thập nhưng khung đọc số là thanh che, không có chữ thật. Declassify làm khung hiện số. | Test e2e hai chế độ; nguồn trang không lộ mục `hold`/`classified` |
| 23.2 | Cài đặt: một nhóm `<g>` với hai `<line>` và một khung chữ, cập nhật bằng `transform`/`textContent`, **không dựng lại SVG**. Ánh xạ x→tháng bằng thang đã lưu đệm, xử lý trong `requestAnimationFrame`. | Unit test ánh xạ x→tháng; frames test |
| 23.3 | Bàn phím: mũi tên đã có thì đồng bộ vị trí chữ thập với tiêu điểm bàn phím. Cảm ứng: chạm hiện chữ thập, kéo ngang để lướt, vẫn cuộn dọc được (`touch-action: pan-y`). | Playwright (bàn phím, `hasTouch`) |
| 23.4 | Mục `paused` (từ P20) không đếm trong số cam kết ở chữ thập. | Unit test |

## P24 — Nút "Yêu cầu giải mật tài liệu"
| # | Step | Verify |
|---|---|---|
| 24.1 | Thêm `contact.email` vào `content/identity.json` (giá trị ở `DECISIONS-v3.md`). `check:leaks` thêm **allowlist đúng một địa chỉ này** (`tools/leak-allow.json`); mọi email/số điện thoại khác vẫn làm thất bại. | `check:leaks` qua với email này; thử thêm một email khác thì thất bại |
| 24.2 | Nút ở khu bằng chứng của mỗi mục `open` có bằng chứng loại `document-on-request` (hiện ở Giải mật), và một nút chung ở cuối trang. Mục `hold`/`classified` **không** có nút. | Test hiển thị theo loại mục |
| 24.3 | `mailto:` với tiêu đề `[CUPID-2610-02] Yêu cầu giải mật tài liệu` (mã hồ sơ của mục) và thân thư mẫu vi/en, các dòng trống để người xem điền: tên/tổ chức, mục đích, tài liệu cần xem (tên bằng chứng lấy từ `content/`). Mã hóa đúng tiếng Việt có dấu; độ dài URL < 1800 ký tự. Không tự đưa dữ liệu nào của người xem vào thư. | Test tiêu đề/thân theo từng ngôn ngữ; kiểm tra giải mã dấu |
| 24.4 | Nút phụ "Sao chép địa chỉ" (Clipboard API, có phương án dự phòng chọn văn bản) và "Mở bằng Gmail" (liên kết soạn thư Gmail, `target=_blank`, `rel="noopener noreferrer"`). | Playwright đọc `href`; thử trên Edge/Chrome |
| 24.5 | Không biểu mẫu, không backend, không theo dõi. Không làm rối địa chỉ email (lợi ích chống thư rác thấp, mà làm hỏng trợ năng). | Review |

## P25 — Màn hình cổng (splash có chức năng)
Thiết kế: `UX-v3.md` mục 2.

| # | Step | Verify |
|---|---|---|
| 25.1 | Script inline trong `<head>` quyết định `data-gate="show\|skip"` **trước paint**: hiện cổng chỉ khi JS bật, phiên này chưa xem (`sessionStorage`, bọc try/catch), URL không có hash `#...` hay `?skip`, không phải in ấn. Tối đa một lần mỗi phiên. | Test e2e từng đường |
| 25.2 | Nội dung cổng: dải phân loại; mật danh "Cupid" (Decode ≤ 900 ms); dòng "XÁC ĐỊNH NGƯỜI XEM"; ba nút lens; cờ VI/EN; liên kết "Bỏ qua" **hiện từ giây 0**. Không thanh phần trăm giả, không chữ "loading". | Ảnh; đếm hiệu ứng đồng thời ≤ 2 |
| 25.3 | Một thao tác để vào: bấm một nút lens là vào ngay với lens đó. "Bỏ qua"/Esc vào với lens mặc định (Đối tác). Cổng không tự đóng, không bắt chờ. | Test: số thao tác để vào = 1 |
| 25.4 | Nhớ lens và ngôn ngữ (`localStorage`, try/catch), dùng làm mặc định các lần sau. Lens vẫn đổi được ở khối "Bạn đến với tư cách gì?". | Test |
| 25.5 | Trợ năng: lớp phủ có `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; phần nội dung chính đặt `inert` khi cổng mở; tiêu điểm vào nút đầu; khi vào, trả tiêu điểm về `<h1>`. | axe; thử bàn phím và tắt JS |
| 25.6 | Không hiện cổng: liên kết sâu (`#claim-*`), `?skip=1`, in/PDF, tắt JS. Không thêm yêu cầu mạng; JS cổng ≤ 3 KB gzip. | Kiểm tra mạng; size report |
| 25.7 | Dòng định vị theo lens: thêm trường tùy chọn `positioning` (vi/en cho từng lens) do chủ dự án viết; `null` thì dùng dòng hiện tại. **Claude Code không viết nội dung.** | Test hiển thị/ẩn |

## P26 — Chuyển cảnh vào hồ sơ
| # | Step | Verify |
|---|---|---|
| 26.1 | `document.startViewTransition` đóng cổng; animate `::view-transition-new(root)` bằng `clip-path: circle(0 at x y)` đến `circle(bán kính phủ hết)` bắt đầu từ điểm bấm, ~600 ms. Phát hiện tính năng trước khi dùng. | Playwright trace: ≤ 700 ms |
| 26.2 | Thoái lui: không có View Transitions thì cổng mờ dần 250 ms. `prefers-reduced-motion`: đóng tức thì. Điện thoại/màn nhỏ (< 768 px): dùng mờ dần thay vì khẩu độ để bớt chi phí chụp ảnh nền trên CPU yếu. | Test cả ba nhánh |
| 26.3 | Chống kẹt: bọc phần animate trong try/catch; nếu `ready`/`finished` bị từ chối hoặc quá 1200 ms thì ép đóng cổng và trả tiêu điểm. | Test mô phỏng lỗi |
| 26.4 | Phạm vi: chỉ ảnh chụp của `root`; không để hai chuyển cảnh chạy chồng nhau (Declassify, cổng): khóa nút chế độ trong lúc chạy hoặc gọi `skipTransition()`. Áp lens **trước** khi chụp trạng thái mới để sổ cái không chuyển động thêm lần nữa. | Test chồng sự kiện |
| 26.5 | INP khi bấm vào cổng ≤ 200 ms (trình xử lý trả về nhanh, việc nặng làm sau). | Bài đo INP trong playbook |

## P27 — Font và tùy chỉnh đọc
| # | Step | Verify |
|---|---|---|
| 27.1 | Bốn hồ sơ chữ cố định, **không** cho chọn font tự do: "Hồ sơ" (mặc định = bộ hiện tại), "Biên bản" (serif đọc; ứng viên Source Serif 4), "Dễ đọc" (ứng viên Lexend), "Máy chữ" (ứng viên IBM Plex Mono). Claude Code **phải kiểm tra** đủ dấu tiếng Việt và giấy phép mở (OFL); không đạt thì đề xuất thay và báo lại. | `docs/fonts.md` ghi nguồn + giấy phép; render chuỗi thử SPEC §7 |
| 27.2 | Hồ sơ chữ áp cho thân bài và tiêu đề. Nhãn monospace, dải phân loại, số liệu giữ nguyên để không mất nhận diện. | Ảnh 4 hồ sơ × 2 chế độ |
| 27.3 | Tải theo yêu cầu: chỉ font mặc định nạp lúc đầu; font khác nạp khi chọn lần đầu. Tập con Latin + Latin-ext + Việt, woff2, tối đa 2 trọng lượng, `font-display: swap`, font dự phòng có `size-adjust`/`ascent-override` để CLS gần 0. Ngân sách ≤ 70 KB gzip mỗi hồ sơ. | Size report; CLS = 0 khi đổi hồ sơ |
| 27.4 | Bảng "Aa" cạnh công tắc chế độ (dạng disclosure): chọn hồ sơ chữ (tên hiển thị bằng chính font đó), cỡ chữ 3 mức (90/100/115%), bật/tắt con trỏ tùy chỉnh (P21), nút "Mặc định". Vùng bấm ≥ 44 px, Esc đóng, tiêu điểm trả về nút. | axe; Playwright bàn phím |
| 27.5 | Lưu `localStorage` (try/catch), script chống nháy trước paint. In/PDF luôn dùng hồ sơ mặc định, cỡ 100%. | Test; in thử |
| 27.6 | `tools/check-fonts.mjs`: mở từng file font và xác nhận có đủ mã điểm của chuỗi thử tiếng Việt. Thêm thư viện đọc font (fontkit hoặc opentype.js) **sau khi hỏi chủ dự án**. | Script thất bại khi thiếu glyph |
| 27.7 | Không quảng cáo là hỗ trợ chứng khó đọc; gọi là "Dễ đọc". Chữ A+ không làm tràn ngang ở 375 px. | Ảnh 375 px, A+ |

## P28 — Mật bí ẩn hơn, Giải mật thật hơn
Triết lý: "bí ẩn hơn" là *lộ ít hơn*, không phải *nhiều hiệu ứng hơn*; "thật hơn" là *bằng chứng và con số*, không phải trang trí.

| # | Step | Verify |
|---|---|---|
| 28.1 | **Mật, "nhìn đêm":** vầng tối nhẹ theo con trỏ, tối đa 25%, bảo đảm tương phản AA ở mức tối nhất. Dùng một phần tử rất lớn có gradient cố định và **di chuyển bằng `transform`** (không đổi nền mỗi khung), chung vòng lặp với con trỏ (không thêm vòng thứ hai). Có thể tắt ở bảng "Aa". | Script tương phản; frames test |
| 28.2 | **Mật, thanh che "cựa quậy":** hover/focus thanh che thì hiện ký tự khối ngẫu nhiên (▓▒░) trong 200 ms. Không có chữ thật hay chữ liên quan nội dung. | Nguồn trang: không lộ chữ gốc |
| 28.3 | **Mật, hạt nhiễu tĩnh** ≤ 3% trên nền, ảnh ≤ 8 KB lặp lại, không animate (chống vệt sọc ở nền tối). | Size report |
| 28.4 | **Giải mật, cột "Số dư kinh nghiệm":** số tháng tích lũy chạy cộng dồn như số dư sổ cái. Tính từ `period` bằng hợp các tháng có ≥ 1 cam kết không `paused`. Chú thích cách tính. | Unit test với các khoảng chồng lấn |
| 28.5 | **Giải mật, "tờ hồ sơ":** đường kẻ dòng nhẹ, bóng rất nhẹ ở mép thẻ, con dấu "ĐÃ GIẢI MẬT" xoay nhẹ khi Declassify (chỉ `transform` + `opacity`). | Ảnh; reduced-motion |
| 28.6 | **Giải mật, dòng "Nguồn":** mỗi mục ghi tên bằng chứng và bậc bên cạnh nhãn T1/T2/T3. | Test |
| 28.7 | **Giải mật, tài liệu xem trước (tùy chọn):** `evidence.preview` là ảnh do chủ dự án tự che thông tin cá nhân **trước khi** đưa vào repo. Claude Code chỉ dựng khung hiển thị, không xử lý ảnh nhạy cảm; không có ảnh thì ẩn khung. Không dùng chữ ký tay. | Test hiển thị/ẩn |
| 28.8 | DTG cập nhật mỗi phút (tùy chọn, bỏ nếu thấy thừa). Không dùng `requestAnimationFrame` cho việc này. | Review |

## P29 — Chân dung từ buổi chụp 27/10 (một buổi chụp, hai bản xử lý)
Quyết định của chủ dự án: **không chụp lại**, dùng hai ảnh đã chụp (ảnh "nghiêm" và ảnh "cười", cùng tư thế, cùng đồ, 1920×2560). Bản Mật và bản Giải mật đều tạo từ ảnh có sẵn bằng cắt và chỉnh tông.

**Giới hạn chỉnh ảnh (bắt buộc):** chỉ cắt, xoay nhẹ, phơi sáng, tương phản, nhiệt độ màu/độ bão hòa, vầng tối ở viền, làm mờ nền nhẹ, làm nét. **Không** làm mịn da, đổi khuôn mặt hay thân hình, chỉnh mắt/răng, thay hoặc dựng nền bằng AI, xóa vật thể khỏi người. Lý do: site là bằng chứng năng lực có thể mang theo, ảnh phải là người thật.

| # | Step | Verify |
|---|---|---|
| 29.0 | **Việc của chủ dự án:** chép hai file gốc vào `private/portrait-raw/` với tên `calm.jpg` (ảnh nghiêm) và `smile.jpg` (ảnh cười). `private/` nằm trong `.gitignore` (thêm nếu chưa có). Claude Code **không** lấy ảnh từ chỗ khác. | `git status` không thấy `private/` |
| 29.1 | Đọc tỉ lệ thật của khung chân dung trong code (`Portrait.astro`, `src/lib/portrait.ts`) và độ rộng hiển thị ở 1280 px. **Không đoán tỉ lệ.** Chiều rộng ảnh sau khi cắt phải ≥ 2× độ rộng hiển thị nếu ảnh gốc cho phép. | Báo cáo tỉ lệ và kích thước đích |
| 29.2 | Cắt từ vai/ngực lên, tâm theo khuôn mặt, mặt nằm ở khoảng một phần ba phía trên. Cắt đủ chặt để **loại người ngồi ở mép phải ảnh `calm`** và giảm tối đa phần chữ in trên áo thun và biển hiệu phía sau đầu. Tọa độ cắt lưu trong `tools/portrait/crops.json` (mỗi file: left, top, width, height) để chủ dự án chỉnh được. | Ảnh xem trước; không còn người lạ, không đọc được tên quán |
| 29.3 | **Bản Mật (`low`)** từ `calm.jpg`: giảm phơi sáng, tăng tương phản, giảm bão hòa 20–30%, giữ tông ấm để hợp màu đồng thau, thêm vầng tối ở viền. Mặt vẫn phải đọc rõ: vùng mặt có độ sáng trung bình không dưới ngưỡng đề xuất 40/255 (điều chỉnh sau khi chủ dự án xem). | Ảnh xem trước; kiểm tra số đo vùng mặt |
| 29.4 | **Bản Giải mật (`high`)** làm theo **hai phương án**, tạo cả hai để chủ dự án chọn ở Checkpoint: **A)** cùng ảnh `calm`, phơi sáng gần nguyên bản, cân bằng trắng trung tính; **B)** ảnh `smile`, căn sao cho mắt nằm đúng vị trí và cùng tỉ lệ khuôn mặt tương đối với bản Mật, để Declassify là lúc nét mặt đổi từ nghiêm sang cười. Căn bằng cắt và tỉ lệ, **không** biến dạng ảnh. | Hai ảnh xem trước cạnh nhau; chủ dự án chọn A hoặc B |
| 29.5 | Làm mờ nền nhẹ bằng mặt nạ elip mềm bao đầu và thân trên (tọa độ trong `crops.json`). Đây là bước **thử**: nếu mép vai/tóc trông giả hoặc nhòe thì **bỏ làm mờ** và chỉ dùng cắt chặt + vầng tối. | Chủ dự án duyệt bằng mắt ở 375 px và 1280 px |
| 29.6 | Script `tools/portrait/build.mjs` (dùng `sharp`; nếu chưa có trong dependencies thì hỏi chủ dự án trước): xuất AVIF + WebP + JPEG dự phòng, sRGB, **không giữ metadata** (kiểm tra bằng `sharp.metadata()`). Mỗi biến thể ≤ 120 KB. Ảnh xem trước ghi vào `private/portrait-preview/` (git-ignored). | Metadata đầu ra không có EXIF/GPS; size report |
| 29.7 | Declassify: ảnh `high` hiện bằng `clip-path`/`opacity` (≤ 500 ms) cùng chuyển cảnh chế độ; reduced-motion thì đổi tức thì. Chỉ `low` được `fetchpriority="high"`; `high` nạp sau khi rảnh. | Trace; LCP không xấu đi |
| 29.8 | `alt` do chủ dự án duyệt (mô tả thật); không ghi địa điểm chụp. `check:leaks` quét `dist/` không còn EXIF, không có file trong `private/`. Thay ống ngắm giữ chỗ bằng ảnh thật. | Review; `check:leaks` |

**Checkpoint P29:** chủ dự án xem ảnh xem trước (bản Mật, hai phương án Giải mật, có/không làm mờ nền) và chọn.

## P30 — Rà soát hiệu năng và phát hành (P20 cũ)
| # | Step | Verify |
|---|---|---|
| 30.1 | Chạy `pnpm perf` (size report + Lighthouse mobile/desktop + frames + INP) theo `docs/performance-playbook.md`; điền bảng trước/sau vào `docs/perf-log.md`. | Bảng số liệu |
| 30.2 | Ngưỡng: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (ngưỡng "tốt" Google công bố); Lighthouse performance ≥ 90 mobile, ≥ 95 desktop; p95 thời gian khung ≤ 20 ms (không giảm tốc) và ≤ 40 ms (CPU chậm 4 lần). | Số liệu qua ngưỡng, hoặc ghi rõ ngoại lệ chủ dự án chấp nhận |
| 30.3 | Cắt tỉa theo `UX-v3.md` mục 8: hiệu ứng nào làm vượt ngưỡng mà không cải thiện cảm nhận thì tắt hoặc xóa. | Danh sách đã cắt |
| 30.4 | a11y: axe, đi bàn phím cả trang, reduced-motion, `inert`/tiêu điểm của cổng, tắt JS, chữ A+ ở 375 px. | Tất cả qua |
| 30.5 | `check:leaks` (kể cả allowlist email), noindex cho đến ngày ra mắt, repo private, `private/` không nằm trong git. | Tất cả qua |
| 30.6 | Phát hành: giữ nguyên các bước ở `ROADMAP.md` (chỉ `build:prod`, chỉ deploy khi chủ dự án yêu cầu). Việc chủ dự án còn mở: ảnh chân dung, tên miền, phê duyệt Prudential và DFL24, duyệt chữ AAR/rủi ro/dòng định vị. | Danh sách còn mở |
