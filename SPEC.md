# SPEC — Cupid Dossier

Bản nháp v0.1, ngày 24/10/2026. Chủ dự án: Lê Thái Trung. Mọi dòng "Done when" phải kiểm chứng bằng lệnh thật, không viết "chắc chạy được".

## 1. Mục tiêu
Một trang CV/portfolio khác lạ, mang hai sắc thái quân đội và tài chính. Gây tò mò bằng cách trình bày, nhưng mọi điều được công bố đều phải kiểm chứng được.

Câu định vị (chủ dự án đã chọn): "khả năng dịch hệ thống phức tạp thành hành động cho một người cụ thể, một tập thể cụ thể".
Bản tiếng Anh nháp, chờ chủ dự án duyệt: "The ability to translate complex systems into action for a specific person, a specific team."

Hoàn thành v1 khi: P0 đến P6 trong `ROADMAP.md` xong, `pnpm typecheck && pnpm test && pnpm build && pnpm check:leaks && pnpm e2e` đều qua, và chủ dự án đã duyệt bằng mắt.

## 2. Đối tượng
- Chính: doanh nhân và đối tác.
- Phụ: khách hàng (bảo hiểm, thực phẩm B2B).
- Người duyệt nội dung cuối cùng: chủ dự án.

## 3. Ngoài phạm vi
- Không CMS, database, đăng nhập, trang riêng tư hay khu vực đặt mật khẩu.
- Không bình luận chính trị hay địa chính trị. Ngoại lệ duy nhất: bản đồ ở mục 8.
- Không analytics, cookie, form lưu dữ liệu. Liên hệ (nếu có) chỉ là `mailto:` do chủ dự án chọn.
- Không tự bịa nội dung, kể cả "mật" giả. Mỗi khối bị che phải ứng với một thứ có thật.

## 4. Kiến trúc thông tin
`/` chọn ngôn ngữ, chuyển tới `/vi/` (mặc định) hoặc `/en/`. Mỗi ngôn ngữ có:
1. **Cấp 0 (Gate):** tên/mật danh, câu định vị, nút đổi chế độ. Rất ít chữ.
2. **Timeline (sổ cái):** các mục từ `content/claims.json`.
3. **Bản đồ bốn điểm:** mục 8.
4. v1.1: chọn hướng hồ sơ (P7). v2: hồ sơ vụ việc (case files).

## 5. Hai chế độ đọc (toggle theme)
Tên: **Mật** (tối, mặc định) và **Giải mật** (sáng). EN: Classified / Declassified.

- Cùng một kho nội dung, hai cách hiển thị. **Cả hai chế độ đều hiện tổ chức, chức danh và khoảng thời gian của mọi mục `open`**, để người xem luôn thấy điều kiểm chứng được. Khác biệt chỉ ở độ chi tiết: chế độ Mật dùng `teaser` và các khối che; chế độ Giải mật thêm `summary` và liên kết bằng chứng.
- Mục `classified` ở cả hai chế độ chỉ có nhãn loại. Chế độ Giải mật không bao giờ hiện thêm chữ cho mục này.
- Mỗi khối che có liên kết "Xem bản giải mật" để đổi chế độ và cuộn tới đúng mục.
- Mặc định là Mật, không theo `prefers-color-scheme`. Lần đầu vào có gợi ý nhỏ về nút Giải mật.
- Lưu lựa chọn bằng `localStorage` bọc try/catch. Trang vẫn đúng khi storage không dùng được.
- Không nháy sai chế độ khi tải: script inline chặn trong `<head>` đặt `data-mode` trước khi vẽ.
- Nút đổi chế độ là `button` có `aria-pressed`, dùng được bằng bàn phím, có focus rõ.
- Khối che là hình vẽ (SVG hoặc CSS) **không chứa chữ thật**. Độ dài thanh che ngẫu nhiên theo lần build, không tỉ lệ với độ dài chữ bị che. Che bằng blur hoặc `display:none` trên chữ thật là **cấm**, vì View Source đọc được.

Done when: test e2e nạp trang với chế độ đã lưu và xác nhận `data-mode` có trước khi trang vẽ; test xác nhận HTML của một mục `classified` không chứa chuỗi nào ngoài nhãn; test xác nhận ở chế độ Mật mọi mục `open` vẫn hiện đủ tổ chức, chức danh, khoảng thời gian.

## 6. Sổ cái nội dung (thay cho database)
Không database. Dữ liệu là file JSON trong `content/`, kiểm tra bằng Zod qua content collections của Astro.

Mỗi mục trong `claims.json`:
```
id            string, duy nhất
kind          "role" | "education" | "project" | "classified"
visibility    "open" | "hold"            (với kind=classified: luôn hiển thị nhãn)
status        "verified" | "needs-evidence" | "needs-decision" | "needs-approval"
org           { vi, en } | null
title         { vi, en } | null
period        { start: "YYYY-MM"|"YYYY", end: "YYYY-MM"|"YYYY"|"present"|null } | null
teaser        { vi, en } | null          dùng ở chế độ Mật
summary       { vi, en } | null          dùng ở chế độ Giải mật
evidence      [{ type: "link"|"document-on-request"|"reference", url?, note }]
notes         string                     ghi chú nội bộ, KHÔNG xuất ra build
```
Ràng buộc schema (phải có unit test cho từng điều):
- `kind="classified"` chỉ được có `id`, `label {vi,en}`, `status`, `period` tuỳ chọn. Mọi trường chữ khác bị từ chối.
- `status="verified"` bắt buộc `evidence` không rỗng.
- Mục `visibility="open"` (không phải `classified`) bắt buộc `org` hoặc `title` khác `null`, và `period` khác `null`. Không để lọt một hàng rỗng lên web.
- Mọi chuỗi hiển thị phải có cả `vi` và `en`. Ngôn ngữ khác (`es`, `ar`, `ja`) chỉ được xuất khi có cờ `reviewed: true` (đã người bản ngữ duyệt).
- `notes` không bao giờ vào bản build.

**Cổng sổ cái:** `pnpm build` ở chế độ production **thất bại** nếu còn mục `visibility="open"` có `status` khác `verified`. Ở chế độ dev, mục chưa verified hiện huy hiệu "UNVERIFIED". Mục `hold` không được biên dịch.

Các file khác: `content/identity.json` (tên, mật danh theo ngôn ngữ, câu định vị), `content/places.json` (bốn điểm trên bản đồ).

Chủ dự án nhập liệu bằng cách sửa trực tiếp các file JSON này. Claude Code không được tự điền chỗ `null`.

## 7. Ngôn ngữ và danh tính
- v1: `vi` và `en`. Khung đa ngôn ngữ phải cho phép thêm ngôn ngữ chỉ bằng cách thêm nội dung, không sửa mã. Hỗ trợ `dir="rtl"` từ đầu (cho tiếng Ả Rập sau này).
- Tên thật **Lê Thái Trung** và mật danh theo ngôn ngữ: Cupid (en), Calisto (es), Khalid (ar), Musashi (ja). Mỗi mật danh luôn mang nhãn "mật danh" và có một dòng định vị riêng (chủ dự án viết).
- Tên thật luôn có một vị trí cố định ở chế độ Giải mật. Ở chế độ Mật, cách thể hiện tên thật là quyết định thiết kế: đưa 2 đến 3 phương án cho chủ dự án chọn ở P2.
- Đổi ngôn ngữ thì mật danh đổi theo, kèm chuyển cảnh ngắn.
- Tiếng Việt có dấu phải hiển thị đúng ở mọi nơi. Thêm test với chuỗi: `Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự`.

## 8. Bản đồ bốn điểm (ngoại lệ có chủ đích)
Bốn điểm, chỉ ở mức địa phương, không toạ độ chính xác của nhà ở: Thường Tín (quê gốc), Thái Nguyên, Đà Nẵng, Điện Bàn. Toạ độ trong `places.json` là xấp xỉ, Claude Code phải kiểm tra lại với nguồn đáng tin.

- Dùng **bản đồ thật**, tự lưu trữ. Nguồn dữ liệu: Natural Earth, bộ "Admin 0 – Countries" theo góc nhìn Việt Nam (`ne_10m_admin_0_countries_vnm`). Chuyển sang TopoJSON lúc build, vẽ bằng `d3-geo` thành SVG. Không dùng tile hay API bản đồ bên thứ ba, không yêu cầu mạng ngoài.
- Phải thể hiện và ghi nhãn quần đảo Hoàng Sa và Trường Sa thuộc Việt Nam ở mọi ngôn ngữ: "Quần đảo Hoàng Sa (Việt Nam)", "Quần đảo Trường Sa (Việt Nam)"; EN: "Hoang Sa Archipelago (Viet Nam)", "Truong Sa Archipelago (Viet Nam)". Không thêm lời giải thích hay bình luận.
- Nếu dữ liệu không có hai quần đảo ở độ phân giải phù hợp, thêm chúng thành feature riêng, vị trí kiểm theo nguồn chính thống.
- Đọc điều khoản sử dụng của Natural Earth trước khi gói dữ liệu, ghi kết quả vào `docs/LICENSES.md`.
- **Chủ dự án phải duyệt bằng mắt bản đồ trước khi công bố.** Claude Code không tự quyết phần này.

Done when: ảnh chụp e2e cho thấy đủ hai nhãn ở `vi` và `en`; log mạng của trang bản đồ không có request bên thứ ba nào; bốn điểm đúng vị trí tương đối.

## 9. Rò rỉ: kiểm tra tự động
`scripts/check-leaks.mjs` (Node thuần, không thêm dependency) quét toàn bộ `dist/`:
- Mẫu số điện thoại Việt Nam, địa chỉ email lạ (trừ địa chỉ liên hệ được khai trong `identity.json`), ngày đầy đủ dạng `dd/mm/yyyy`.
- Mọi chuỗi chữ của mục `hold` và mọi `notes` phải **không** xuất hiện trong `dist/`.
- Danh sách từ cấm cục bộ `tools/denylist.local.txt`: mỗi dòng một từ, **không commit** (đã nằm trong `.gitignore`), do chủ dự án tự duy trì. Thiếu file thì cảnh báo to, vẫn chạy phần còn lại.
- `dist/` không được chứa file `.map`.
Thoát mã khác 0 nếu có vi phạm. In ra file và dòng vi phạm, không in lại nội dung nhạy cảm.

Trước khi chủ dự án quyết định ra mắt, mọi trang phải có `<meta name="robots" content="noindex">` (một hằng số cấu hình duy nhất, chủ dự án gỡ khi ra mắt).

## 10. Hiệu năng và truy cập
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95. LCP < 2,5 s, CLS < 0,1.
- JS ban đầu mỗi trang ≤ 100 KB gzip, không tính khối bản đồ (tải lười).
- Phông tự lưu trữ, tối đa 2 họ, có tập con tiếng Việt. Ảnh AVIF/WebP có kích thước khai báo.
- Chuyển động chỉ dùng `transform` và `opacity`. `prefers-reduced-motion` thì tắt hết chuyển động.
- Độ tương phản đạt WCAG AA ở cả hai chế độ (viết script kiểm tra token).

## 11. Công nghệ
Astro + TypeScript. Mặc định **không dùng React**: nút chế độ, giải mã mật danh, FLIP và bản đồ viết bằng TypeScript thuần trong các module nhỏ (ít JavaScript, ít dependency). Chỉ thêm React khi một thành phần thực sự khó viết nếu thiếu nó, kèm một dòng lý do (dev-discipline mục 2). CSS thuần với biến token (hai bộ token cho hai chế độ). Zod qua content collections. `d3-geo` + `topojson-client` cho bản đồ. Vitest cho unit test, Playwright cho e2e (kèm kiểm tra axe). Mỗi dependency mới phải có một dòng lý do (theo dev-discipline mục 2). Chuyển động ưu tiên CSS, chỉ thêm thư viện khi CSS không đủ. Host mục tiêu: Vercel (tĩnh). **Chỉ deploy khi chủ dự án yêu cầu.** Mọi lần deploy, kể cả bản preview, dùng build production. Xem thử nội dung chưa verified chỉ ở máy cục bộ, vì link preview vẫn là một địa chỉ web.

## 12. Lộ trình
Lộ trình chi tiết, từng bước và cách kiểm chứng nằm ở `ROADMAP.md` (phase P0 đến P9). Hành vi và chuyển động nằm ở `UX.md`. Không lặp lại ở đây để tránh hai nguồn sự thật.

## 13. Việc đang chờ chủ dự án (Claude Code không được tự điền)
- Ngày bắt đầu/kết thúc của từng vai trò; tên ngành và mốc tốt nghiệp đúng theo bằng.
- Một dòng định vị cho từng mật danh.
- Duyệt của Prudential về cách trình bày chức danh; duyệt của DFL24 về điều được công khai; cách kể thống nhất về Bluesea Food; câu chữ dòng JCI.
- Cách liên hệ công khai (email nào, hay không có); tên miền; ảnh chân dung (hai ảnh hiện có chưa dùng được, xem `UX.md` mục 5, cần chụp mới).
- Duyệt bản đồ trước khi công bố.
