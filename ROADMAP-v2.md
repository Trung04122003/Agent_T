# ROADMAP v2 — P9 đến P20

Áp dụng sau khi P0–P8 đã xong. **P9 cũ (phát hành) được đổi thành P20.** File này bổ sung cho `ROADMAP.md`, không thay thế các quy tắc ở đó. Thiết kế chi tiết nằm ở `UX-v2.md`.

## Quy tắc riêng của v2
1. Mỗi phiên làm đúng một phase, theo từng dòng `step -> verify`, dừng ở Checkpoint chờ chủ dự án.
2. **Không tự viết nội dung.** Các khối do chủ dự án cung cấp (BLUF, tear sheet, AAR, rủi ro) mà dữ liệu là `null` thì **không hiển thị khối đó** và liệt kê câu hỏi cần hỏi. Không bịa số liệu, không bịa ngày.
3. Mọi biểu đồ chỉ vẽ từ dữ liệu có trong `content/`. Không có số liệu giả, không có "lợi nhuận", "tăng trưởng", mã cổ phiếu thật.
4. Không dùng logo, huy hiệu, con dấu của cơ quan thật (FBI, CIA, quân đội, sở giao dịch). Chỉ dùng ngôn ngữ hình ảnh chung.
5. Ngân sách chuyển động (xem `UX-v2.md` mục 1): tối đa **một hiệu ứng nổi bật mỗi màn hình**, tối đa 2 hiệu ứng chạy đồng thời. Chỉ animate `transform`, `opacity`, `clip-path`.
6. Cuối mỗi phase: `pnpm typecheck && pnpm test && pnpm build && pnpm check:leaks`, đọc kết quả, chụp ảnh 375px và 1280px ở cả hai chế độ để chủ dự án duyệt.
7. Không commit, push, deploy trừ khi chủ dự án yêu cầu.

---

## P9 — Sửa lỗi nội dung và schema (chưa thêm tính năng)

| # | Step | Verify |
|---|---|---|
| 9.1 | Xóa giọng nội bộ "Chủ dự án cho biết…" khỏi mọi `teaser`/`summary`. Viết lại ngôi thứ ba trung tính, chỉ dùng dữ kiện đã có trong `content/` hoặc CV gốc. Chỗ nào không chắc: đặt `null` và liệt kê câu hỏi cho chủ dự án. | `grep -ri "chủ dự án cho biết" content src` ra 0 kết quả; build qua |
| 9.2 | Sửa `Ledger.astro`: `teaser` chỉ hiện ở Mật, `summary` chỉ hiện ở Giải mật. Không bao giờ hiện cả hai cùng lúc. | Test: Mật có teaser, không summary; Giải mật có summary, không teaser |
| 9.3 | Thanh che nhất quán: dòng `open` nào có `summary` thì có thanh che + liên kết "Xem bản giải mật" ở Mật; dòng không có `summary` thì không có liên kết. | Test Ledger cho cả hai trường hợp; ảnh chụp Mật |
| 9.4 | Schema: `org` trùng `title` (so sánh sau khi chuẩn hóa) thì build lỗi. Sửa `project-air-quality`. | Test schema; `pnpm build` |
| 9.5 | Ngày tháng: bỏ "Dự kiến tốt nghiệp" (đã tốt nghiệp 06/2026). Ngày kết thúc ở tương lai không được ghi như sự thật: dùng `ongoing: true` hiển thị "nay", hoặc bỏ ngày kết thúc. Với Prudential và Bluesea, **hỏi chủ dự án câu chữ** (Bluesea: tạm dừng vai trò, dự kiến quay lại 2027). | Test schema từ chối end date > ngày build mà không có `ongoing`; chủ dự án duyệt câu chữ |
| 9.6 | Cổng phê duyệt: thêm trường `approval: { by, on }`. Mục có `org` thuộc danh sách `approvalRequired` (Prudential, DFL24) chỉ được `open` khi có `approval`; ngược lại build production thất bại. Hiện chuyển Prudential về `hold`. | Test: Prudential `open` không có `approval` thì build prod lỗi |
| 9.7 | **Bậc bằng chứng.** Bỏ chữ "ĐÃ KIỂM CHỨNG". Đổi `status: verified` thành `confirmed` (chủ dự án xác nhận nội dung). Thêm bậc **tính tự động, không nhập tay**: T1 tự khai (không có bằng chứng ngoài), T2 tài liệu theo yêu cầu (`document-on-request`), T3 có liên kết công khai hoặc người xác nhận đã đồng ý (`link` có `url`, hoặc `reference` có `consent: true`). Giao diện hiện nhãn "Bằng chứng T1/T2/T3" kèm chú thích. | Test: mục chỉ có `document-on-request` ra T2, có `link` ra T3; không còn chuỗi "KIỂM CHỨNG" trong `dist/` |
| 9.8 | Làm sạch nhỏ: kiểu liên kết ngôn ngữ, ảnh chân dung giữ chỗ, trạng thái đang chọn của lens, nhãn bản đồ (viền chữ, không chồng lấn). | Ảnh chụp 375/1280 hai chế độ; chủ dự án duyệt |

**Checkpoint P9:** chủ dự án đọc lại toàn bộ chữ trên site và duyệt.

## P10 — Công tắc ngôn ngữ bằng quốc kỳ
Thiết kế: `UX-v2.md` mục 2.

| # | Step | Verify |
|---|---|---|
| 10.1 | Đưa cờ SVG tự lưu trữ vào `src/assets/flags/` (chỉ những cờ cần dùng; đọc và ghi lại giấy phép của bộ cờ trong `docs/`). **Không dùng emoji cờ** (Windows không hiển thị). | Mở trên Edge/Chrome Windows: thấy cờ thật, không thấy chữ "VN" |
| 10.2 | Component `LangSwitch` thành nhóm nút: cờ + mã (VI, EN) + `aria-label` đầy đủ, `lang` đúng trên từng nút. Vẫn là liên kết thật tới URL ngôn ngữ (chạy khi tắt JS), giữ `hreflang`. | Playwright: tắt JS vẫn chuyển được; Tab/Enter dùng được |
| 10.3 | Chỉ hiển thị ngôn ngữ có đủ nội dung. Script build kiểm tra khóa nào thiếu bản dịch thì ẩn ngôn ngữ đó và báo. Giai đoạn đầu chỉ VI + EN. | Test: thêm khóa thiếu `es` thì `es` không xuất hiện trên công tắc |
| 10.4 | Giữ hiệu ứng Decode của mật danh khi đổi ngôn ngữ; RTL chỉ bật khi có `ar` đầy đủ. | Test e2e đổi vi→en: mật danh đổi, không giật bố cục |

**Checkpoint P10:** chủ dự án chọn cờ cho tiếng Anh (Anh hay Mỹ) và duyệt kiểu hiển thị.

## P11 — BLUF cho từng dòng sổ cái
| # | Step | Verify |
|---|---|---|
| 11.1 | Thêm trường tùy chọn `bluf` (vi/en, tối đa 90 ký tự, một câu, có động từ, không tính từ khen). | Schema từ chối dài hơn 90 ký tự |
| 11.2 | Hiển thị BLUF ngay dưới tiêu đề dòng ở cả hai chế độ. `null` thì không hiển thị. | Test hiển thị/ẩn |
| 11.3 | Xuất danh sách các dòng đang thiếu BLUF để hỏi chủ dự án. **Không tự viết.** | Báo cáo cuối phiên có danh sách câu hỏi |

## P12 — Hệ thống hình ảnh v2 (token, lưới, chữ số)
| # | Step | Verify |
|---|---|---|
| 12.1 | Cập nhật `tokens.css` theo `UX-v2.md` mục 3: lưới đường kẻ mảnh, số tabular, khung góc (corner bracket), một màu nhấn duy nhất. | Script tương phản WCAG AA qua |
| 12.2 | Gate (màn hình đầu) v2: một điểm nhấn duy nhất, không thêm phần tử khác. | Ảnh chụp; đếm hiệu ứng đồng thời ≤ 2 |
| 12.3 | Bảng cắt bỏ: rà soát mọi hiệu ứng hiện có theo `UX-v2.md` mục 6, xóa cái nào không được giữ. | Danh sách đã xóa trong báo cáo |

## P13 — Chế độ Mật: giao diện "bàn điều hành"
| # | Step | Verify |
|---|---|---|
| 13.1 | Dải phân loại chung ở đầu trang (chữ do mình đặt, ví dụ "HỒ SƠ CÁ NHÂN · CẤP: MẬT"), không dùng cụm từ hay biểu tượng của cơ quan thật. | Review thủ công |
| 13.2 | Mã hồ sơ, nhóm ngày-giờ (DTG) dựng lúc build, số trang "1/3". Chỉ là bề mặt, không chứa dữ kiện mới. | `check:leaks` qua; không có thông tin cá nhân mới |
| 13.3 | Con dấu (stamp) khi mở dòng: `transform` + `opacity`, tối đa 250 ms. | Reduced-motion: đổi tức thì |
| 13.4 | Đường nét "ống ngắm" ở khung ảnh và bản đồ (chỉ vector, không ảnh nền nặng). | Dung lượng trong ngân sách |

## P14 — Chế độ Giải mật: giao diện "sàn dữ liệu"
| # | Step | Verify |
|---|---|---|
| 14.1 | Nền sáng, đường kẻ mảnh, số tabular, mật độ cao hơn Mật ở khu vực số liệu. | Ảnh chụp; không cuộn ngang ở 375px |
| 14.2 | Nhãn bằng chứng T1/T2/T3 dạng thanh nhỏ (không dùng đỏ/xanh làm tín hiệu duy nhất). | Kiểm tra giả lập mù màu |
| 14.3 | Khối "số liệu đầu trang" chỉ gồm 3–5 con số **tính từ content** (ví dụ số mục, số năm hoạt động, số bậc T3). | Test: mọi số đều truy được về `content/` |

## P15 — Biểu đồ cam kết (hai cách vẽ, một dữ liệu)
Thiết kế: `UX-v2.md` mục 4. Dữ liệu duy nhất: `period` của các mục `open`.

| # | Step | Verify |
|---|---|---|
| 15.1 | Hàm build tính số cam kết đồng thời theo tháng từ `period`. | Unit test với dữ liệu cố định |
| 15.2 | SVG tĩnh dựng lúc build, không thư viện biểu đồ nặng. Giải mật: đường bậc thang có nhãn năm, rê chuột hiện tên mục. Mật: cùng dữ liệu nhưng vẽ như tín hiệu, nhãn bị che. | Ảnh hai chế độ; nguồn trang không lộ mục `hold`/`classified` |
| 15.3 | Bàn phím + mô tả văn bản thay thế (bảng ẩn cho trình đọc màn hình). | axe qua |
| 15.4 | Không có trục tiền, không có "tăng trưởng". Chú thích: "Số cam kết đồng thời theo thời gian". | Review chữ |

## P16 — Chuyển cảnh Giải mật v2
| # | Step | Verify |
|---|---|---|
| 16.1 | Khi Declassify: thanh che co lại, dải phân loại đổi chữ, đường biểu đồ hiện dần bằng `clip-path`. Tổng ≤ 600 ms. | Đo bằng Playwright trace |
| 16.2 | Phương án thay thế khi `prefers-reduced-motion` và khi không có View Transitions API. | Test cả hai |

## P17 — Khối nội dung do chủ dự án viết: Tear sheet, AAR, Rủi ro
| # | Step | Verify |
|---|---|---|
| 17.1 | Tear sheet tùy chọn cho mỗi dự án: vai trò, quy mô, thời gian, kết quả, bậc bằng chứng. Ô nào `null` thì bỏ, không điền chữ giữ chỗ. | Test: tear sheet rỗng không render |
| 17.2 | `aar` tùy chọn, bốn trường: dự định, thực tế, vì sao khác, lần sau. Mật chỉ hiện nhãn, Giải mật mở ra. | Schema ép đủ 4 trường hoặc không có |
| 17.3 | Mục "Giới hạn và rủi ro" (kiểu Risk Factors, viết về chính chủ dự án) ở cuối trang, mỗi mục gồm rủi ro + cách giảm. | Chủ dự án tự viết; Claude Code chỉ dựng khung |

## P18 — Hồ sơ một trang (in / PDF)
| # | Step | Verify |
|---|---|---|
| 18.1 | Bản in = Giải mật, một trang A4, dựng từ cùng `content/`, không dữ liệu riêng. | In thử ra PDF, kiểm tra không có mục `hold`/`classified` |
| 18.2 | Nút "Tải hồ sơ một trang" chỉ xuất hiện sau khi chủ dự án duyệt. | Review |

## P19 — Rà soát tổng
| # | Step | Verify |
|---|---|---|
| 19.1 | Hiệu năng, a11y, e2e, so ảnh chụp trước/sau, `check:leaks`. | Tất cả qua |
| 19.2 | "Bớt đi": gỡ mọi thứ mà chủ dự án thấy rối (xem `UX-v2.md` mục 6). | Chủ dự án duyệt lần cuối |
| 19.3 | Đóng băng nội dung; đối chiếu từng dòng `open` với phê duyệt. | Danh sách đối chiếu |

## P20 — Phát hành (P9 cũ)
Giữ nguyên các bước ở `ROADMAP.md` (repo private, build bản production, noindex cho đến ngày ra mắt, chỉ deploy khi chủ dự án yêu cầu). Việc chủ dự án còn mở: ảnh chân dung mới (đã xóa EXIF), tên miền, phê duyệt Prudential và DFL24, cách liên hệ.
