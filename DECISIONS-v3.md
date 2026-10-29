# DECISIONS v3 — quyết định của chủ dự án (27/10/2026)

Claude Code đọc file này cùng `ROADMAP-v3.md` và `UX-v3.md`. Mọi chữ về người thật do chủ dự án cung cấp; không tự thêm ý.

## Liên hệ (P24)
- Email công việc dùng cho nút "Yêu cầu giải mật tài liệu": `lethaitrungwork@gmail.com`
- Đây là địa chỉ **duy nhất** được phép xuất hiện trong `dist/` (allowlist trong `check:leaks`). Mọi email và số điện thoại khác vẫn bị chặn.
- Không đăng số điện thoại. Không biểu mẫu, không backend.

## Con trỏ (P21–P23)
- Mật: con trỏ CSS ống ngắm đồng thau + vòng JS "khóa mục tiêu" (phóng to, xoay 45° khi vào mục tiêu).
- Giải mật: con trỏ CSS chữ thập mảnh + khung chọn trượt (thay cho ý tưởng "gậy thần", đã bỏ vì gợi quảng cáo hứa hẹn tiền và mâu thuẫn quy tắc không ngụ ý hiệu suất đầu tư).
- Biểu đồ: đường chữ thập + khung đọc số (Mật: thanh che).

## Font (P27)
- Bốn hồ sơ chữ cố định, không cho chọn font tự do. Ứng viên phải qua bài thử tiếng Việt đủ dấu và giấy phép mở.

## Cổng và chuyển cảnh (P25–P26)
- Có màn hình cổng, nhưng là cổng **chức năng** (chọn lens và ngôn ngữ), bỏ qua được ngay, tối đa một lần mỗi phiên.
- Chuyển cảnh khẩu độ vào hồ sơ, có thoái lui.
- **Ngoại lệ (chủ dự án duyệt khi xem P25, 28/10/2026):**
  - Mỗi phân khúc (Đối tác, Khách hàng, Tò mò) có một dòng định vị riêng, giọng kỳ bí và cuốn hút, viết theo skill humanizer. Claude Code viết bản nháp vào `positioning` của `content/lenses.json`, chờ chủ dự án chốt. Dòng này hiện trong cổng khi người xem trỏ vào một lens, và thay dòng chung ở đầu trang sau khi vào. Mỗi dòng có hai phiên bản như dòng chung (chủ dự án yêu cầu cùng ngày): bản bí ẩn cho Mật (`positioningMat`) và bản rõ ràng, chân thành cho Giải mật (`positioning`).
  - Riêng P25 được đo cổng (phân tích) mà không theo quy tắc "không analytics" của SPEC. Chủ dự án chọn đo cục bộ trước: sự kiện của cổng chỉ ghi trong trình duyệt, không gửi đi đâu, kèm một bài đánh giá trong phòng thử (`docs/gate-evaluation.md`). Nhà cung cấp để đo người xem thật được chọn lúc phát hành (P30).

## Nội dung chủ dự án phải tự viết lại (Claude Code không được đụng)
- Dòng định vị đầu trang ("Khả năng dịch hệ thống phức tạp…"): trừu tượng, dài; thử bài 5 giây với 3 người lạ.
- "Giới hạn và rủi ro" mục 02 và 03: đang viết như khuyết điểm tính cách; nên viết thành rủi ro hoàn cảnh kèm cách giảm đo được.
- AAR của BBE: mục "vì sao khác" và "lần sau" cần cụ thể hơn (một hành động, một con số).
- Các con số thành quả (`metrics`) và BLUF còn thiếu.

**Ngoại lệ (chủ dự án duyệt sau P20, 27/10/2026):** cho phép Claude Code viết lại **dòng định vị** và **"Giới hạn và rủi ro" mục 02, 03**, mỗi thứ hai phiên bản: bản bí ẩn cho Mật (`positioningMat`, `mat` trong `risks.json`) và bản chân chính cho Giải mật (bản này cũng dùng cho in và SEO). Chủ dự án là người nhiệt huyết, đam mê, tận tụy; dòng định vị cần mạnh mẽ. Chủ dự án đã chốt cả hai phiên bản cùng ngày (27/10/2026). AAR của BBE và `metrics` vẫn do chủ dự án viết (cần dữ kiện thật).

## Vẫn cấm tuyệt đối trên site
- Bất cứ điều gì về vai trò trợ lý cho thầy Cường / FBV, dưới mọi hình thức (kể cả thanh che).
- Chính trị, địa chính trị (trừ bản đồ chủ quyền Hoàng Sa, Trường Sa đã duyệt).
- Logo, huy hiệu của cơ quan thật; số liệu giả; ngụ ý hiệu suất đầu tư; chữ ký tay.
- Prudential và DFL24 chỉ lên site khi có `approval`.
  - **Prudential đã bật (chủ dự án yêu cầu 29/10/2026):** trưởng văn phòng/đại lý Prudential (văn phòng Ngũ Hành Sơn) duyệt ngày 01/07/2026, đúng câu chữ hiện có trong `claims.json`. Chủ dự án chọn mức duyệt này thay cho bộ phận tuân thủ. `approval` ghi chức vụ, không ghi tên người. DFL24 vẫn `hold`.

## Buổi chụp ảnh (P29)
- Ảnh gốc để ngoài git (`private/portrait-raw/`), chỉ bản đã xóa EXIF/GPS vào repo.
- Chụp hai độ sáng cùng tư thế, cùng đồ, dùng chân máy: bản tối cho Mật, bản sáng hơn cho Giải mật.
- **Chủ dự án chốt ở Checkpoint P29 (29/10/2026):**
  - Mật dùng ảnh nghiêm (`calm`); Giải mật dùng **phương án B**, ảnh cười (`smile`), căn mắt để lúc giải mật chỉ nét mặt thay đổi.
  - **Có làm mờ nền.** Đây là cách duy nhất để tên quán phía sau đầu không còn đọc được, vì khung cắt nào đủ rộng cũng chứa nó.
  - Nhãn trên khung ảnh: "Agent T" (Mật) và "Lê Thái Trung" (Giải mật).
  - Alt mô tả ảnh, không ghi địa điểm.
  - Cả hai nằm trong `content/portrait.json`; toạ độ cắt nằm trong `tools/portrait/crops.json`.
- Không logo công ty (nhất là Prudential), không đồ mang hơi hướng quân đội, không địa điểm nhận ra được.

## Tên dự án (28–29/10/2026)
- Chủ dự án chốt **Agent T** (T là Trung). Đã cân nhắc các rủi ro: tên chung chung, trùng với nhiều sản phẩm AI và nhân vật phim (quy ước "Agent + một chữ cái" là của Men in Black, có nhân vật High T), lộ chữ cái đầu của tên thật, không khớp hệ mật danh theo ngôn ngữ. Chủ dự án chấp nhận.
- Giả định cần chủ dự án xác nhận: Agent T là **tên dự án/hồ sơ** (tiêu đề, dải phân loại, nhãn ảnh Mật). Cupid, Calisto, Khalid, Musashi vẫn là mật danh cá nhân theo ngôn ngữ. Mã hồ sơ `CUPID-2610` giữ nguyên.
- Việc của chủ dự án: kiểm tra tên miền và mức trùng tên trong ngành.

## Nhạc nền (29/10/2026)
- Bài chọn: **"Rush" của Soundroll** (album *Total Overdrive*), nhạc không lời. Chủ dự án đã tải một bản 360p từ YouTube bằng IDM để nghe thử. File đó **chỉ dùng thử trên máy**, không đưa vào repo, bản build hay deploy.
- **Chưa có giấy phép.** Theo trang của Soundroll: bản nghe thử miễn phí chỉ để đánh giá; phát hành phải mua giấy phép (Personal, Commercial, Broadcast); trang giấy phép **không nêu rõ việc dùng cho website** và cấm remix, bán lại, phân phối lại, đăng ký Content ID. Cần hỏi Soundroll bằng văn bản. Tui chưa xác nhận bài "Rush" có bán trên cửa hàng đó.
- Chưa có giấy phép thì bản production **không có nhạc và không hiện công tắc âm thanh** (`check:audio`).
- Hành vi: mặc định **tắt tiếng**, người xem tự bật (chủ dự án chưa trả lời câu này, đây là giả định). Một bài, hai tông: Mật lọc thông thấp, Declassify mở bộ lọc.
