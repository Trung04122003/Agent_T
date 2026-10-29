# UX v3 — con trỏ, cổng, font, và chiều sâu Mật ↔ Giải mật

Bổ sung cho `UX.md`, `DESIGN.md`, `UX-v2.md`. Điểm khởi đầu để chủ dự án duyệt bằng mắt, không phải bản chốt.

## 0. Nguyên tắc
- **Bí ẩn hơn = lộ ít hơn**, không phải thêm hiệu ứng. **Thật hơn = thêm bằng chứng và con số thật**, không phải thêm trang trí.
- Ngân sách chuyển động của `UX-v2.md` mục 1 vẫn giữ: một điểm nhấn mỗi màn hình, tối đa 2 hiệu ứng đồng thời, chỉ `transform`/`opacity`/`clip-path`.
- Mọi hiệu ứng mới có **đường thoái lui không hiệu ứng** và **công tắc tắt** (bảng "Aa").
- Thử nghiệm cuối: đưa cho 3 người lạ xem 5 giây rồi hỏi "bạn nghĩ người này làm gì?" Nếu hiệu ứng làm họ không trả lời được thì cắt.

## 1. Con trỏ
Hai lớp: **con trỏ CSS thật** (không độ trễ, vẫn là con trỏ của hệ điều hành) cộng **một lớp trang trí bằng JS** chỉ khi thiết bị phù hợp.

| | Mật | Giải mật |
|---|---|---|
| Lớp CSS (luôn có khi chuột) | Ống ngắm đồng thau mảnh, ≤ 32×32, điểm nóng ở tâm | Chữ thập mảnh + ô vuông nhỏ, đồng thau đậm |
| Lớp JS | Vòng ống ngắm bám theo, trễ nhẹ; vào mục tiêu thì phóng 1.4 lần, xoay 45° trong 180 ms ("khóa mục tiêu") | Khung chọn bốn góc trượt đến phần tử đang hover; gạch chân đồng thau quét qua dòng sổ cái |
| Trên biểu đồ | Đường chữ thập, khung đọc số là thanh che | Đường chữ thập + khung đọc số (ngày, số cam kết) |
| Ý nghĩa | Nhắm mục tiêu | Chọn dòng dữ liệu chính xác |

Giới hạn kỹ thuật cần nhớ (theo MDN): ảnh con trỏ vượt giới hạn của trình duyệt (thường 128×128 px, khuyến nghị 32×32) sẽ bị bỏ qua và con trỏ không đổi; bắt buộc có từ khóa dự phòng ở cuối; CSS cursor là ảnh tĩnh, nên "phóng to và xoay" ở lớp CSS chỉ làm được bằng cách **đổi sang ảnh khác đã xoay sẵn**. Chuyển động mượt nằm ở lớp JS.

Quy tắc:
- Chỉ bật khi `(hover: hover) and (pointer: fine)`; lớp JS còn cần `prefers-reduced-motion: no-preference`. Điện thoại không có con trỏ nên **không được phụ thuộc** vào hiệu ứng này.
- Không `cursor: none`. Chữ chọn được giữ con trỏ `text`.
- **Viền tương phản 1 px** trên mọi ảnh con trỏ: đồng thau trên dải đồng đặc hoặc đồng đậm trên thanh che đen sẽ biến mất nếu không có viền.
- **Bỏ ý tưởng "gậy thần phát hào quang tiền tệ"**: ngôn ngữ giả tưởng, gợi quảng cáo hứa hẹn tiền, mâu thuẫn quy tắc "không ngụ ý hiệu suất đầu tư" và "một màu nhấn". Thay bằng khung chọn và đường chữ thập có chức năng thật.

## 2. Màn hình cổng (splash có chức năng)
Hầu hết trang portfolio có màn hình chờ, nhưng loại "đang tải giả" bị chỉ trích nhiều vì bắt người xem chờ vô ích. Cổng của dossier **không giả vờ tải**; nó là bước xác định người xem, gộp luôn việc chọn lens và ngôn ngữ, nên người xem thấy nó có ích.

Luồng:
```
[Dải phân loại]  HỒ SƠ CÁ NHÂN · CẤP: MẬT
MẬT DANH: C u p i d      (Decode, ≤ 900 ms)
XÁC ĐỊNH NGƯỜI XEM
[ Đối tác ]  [ Khách hàng ]  [ Tò mò ]        VI | EN
                                         Bỏ qua ›   (hiện từ giây 0)
```
- Một thao tác để vào: bấm một lens là vào ngay. "Bỏ qua" hoặc Esc vào với lens mặc định.
- Nhớ lens và ngôn ngữ cho các lần sau. Cổng tối đa **một lần mỗi phiên**.
- Không hiện khi có liên kết sâu (`#claim-*`), `?skip=1`, khi in/PDF, hoặc tắt JS (khi đó nội dung đã có sẵn trong HTML).
- Trợ năng: `role="dialog"` `aria-modal`, nội dung chính `inert`, tiêu điểm vào nút đầu, trả về `<h1>` khi vào.
- Dòng định vị đầu trang có thể đổi theo lens (chủ dự án tự viết từng dòng, `null` thì dùng dòng chung).
- Rủi ro cần biết: cổng thêm một cú bấm. Nếu đo thấy người xem bỏ đi nhiều hơn, bỏ cổng. Đây là một thử nghiệm, không phải chân lý.

## 3. Chuyển cảnh "khẩu độ"
Bấm lens, ảnh "khẩu độ mở" lan từ điểm bấm ra toàn màn hình (`clip-path: circle()` trên `::view-transition-new(root)`), ~600 ms, hợp với ngôn ngữ ống ngắm. Cách dựng theo tài liệu Chrome cho same-document view transition: phát hiện `document.startViewTransition`, đợi `ready` rồi animate bằng Web Animations API.

Thoái lui: không hỗ trợ thì mờ dần 250 ms; reduced-motion thì tức thì; màn < 768 px dùng mờ dần. Lý do chọn như vậy: số liệu thực tế đã công bố cho thấy View Transitions làm LCP trễ khoảng 70 ms ở lượt xem lặp trên điện thoại, trễ nhiều hơn khi CPU chậm. Vì vậy phải đo, không giả định.

## 4. Font và tùy chỉnh đọc
Ý tưởng để người xem chọn chữ là hiếm với trang CV (tui chưa kiểm chứng việc "không CV nào có", chỉ thấy hiếm). Đúng hướng, nhưng phải làm có kiểm soát:

| Hồ sơ chữ | Dùng khi | Ứng viên (phải kiểm tra) |
|---|---|---|
| Hồ sơ (mặc định) | Bản sắc dossier | Bộ chữ hiện tại |
| Biên bản | Đọc đoạn dài kiểu văn bản | Source Serif 4 |
| Dễ đọc | Muốn chữ thoáng, dễ quét | Lexend |
| Máy chữ | Hợp chất Mật | IBM Plex Mono |

- **Bốn hồ sơ cố định**, không cho chọn font tự do (font tự do phá bố cục, kéo thêm tệp, và kết quả không còn do chủ dự án kiểm soát).
- Nhãn mono, dải phân loại, số liệu **giữ nguyên** để không mất nhận diện.
- Tải theo yêu cầu, tập con Latin + Latin-ext + Việt, ≤ 70 KB gzip mỗi hồ sơ, font dự phòng chỉnh `size-adjust` để không nhảy bố cục.
- Cỡ chữ 3 mức (90/100/115%). In/PDF luôn dùng mặc định.
- Mọi ứng viên phải qua bài thử tiếng Việt đủ dấu và giấy phép mở. Không quảng cáo là hỗ trợ chứng khó đọc.

## 5. Mật bí ẩn hơn, Giải mật thật hơn

**Mật (lộ ít hơn):**
- "Nhìn đêm": vầng tối nhẹ theo con trỏ (≤ 25%, vẫn đạt AA), dịch chuyển bằng `transform`.
- Thanh che "cựa quậy" khi hover (ký tự khối ngẫu nhiên, không có chữ thật).
- Hạt nhiễu tĩnh ≤ 3% để nền đen có chất và không bị vệt sọc.
- Khi bí ẩn hơn, đừng thêm chữ. Chữ nào chưa cần thì bớt đi.

**Giải mật (thật hơn):**
- Cột "Số dư kinh nghiệm" chạy cộng dồn như sổ cái, tính từ dữ liệu thật.
- Dòng "Nguồn" cho mỗi mục: tên bằng chứng và bậc.
- Tài liệu xem trước đã che (tùy chọn, chủ dự án tự che trước khi đưa vào).
- Con dấu "ĐÃ GIẢI MẬT", tờ hồ sơ có đường kẻ.
- Ảnh chân dung bản sáng hiện ra khi giải mật (xem mục 7 của `DECISIONS-v3.md` về buổi chụp).
- **Không dùng chữ ký tay** (có thể bị sao chép).

## 6. Nút "Yêu cầu giải mật tài liệu"
Bằng chứng T2 là "cung cấp khi có yêu cầu"; nút này là kênh để yêu cầu.
- Nút chính: "Yêu cầu giải mật tài liệu" / "Request declassified documents". Mở thư có sẵn tiêu đề kèm mã hồ sơ của mục và thư mẫu có chỗ điền (tên/tổ chức, mục đích, tài liệu cần xem).
- Nút phụ: "Sao chép địa chỉ", "Mở bằng Gmail".
- Mục `hold`/`classified` không có nút.
- Không biểu mẫu, không backend, không theo dõi, không làm rối địa chỉ.

## 7. Mười bốn ý tưởng (kèm quyết định)
| # | Ý tưởng | Quyết định | Phase |
|---|---|---|---|
| 1 | Con trỏ CSS ống ngắm (Mật) và chữ thập (Giải mật) | Làm | P21 |
| 2 | Vòng ống ngắm "khóa mục tiêu" (Mật) | Làm | P22 |
| 3 | Khung chọn trượt + gạch chân quét (Giải mật) | Làm | P22 |
| 4 | Đường chữ thập trên biểu đồ + khung đọc số | Làm | P23 |
| 5 | Nút "Yêu cầu giải mật tài liệu" | Làm | P24 |
| 6 | Cổng chức năng (lens + ngôn ngữ), tối đa một lần/phiên | Làm, đo hiệu quả | P25 |
| 7 | Dòng định vị theo lens (chủ dự án viết) | Làm khi có nội dung | P25 |
| 8 | Chuyển cảnh khẩu độ vào hồ sơ | Làm | P26 |
| 9 | Bốn hồ sơ chữ + cỡ chữ | Làm | P27 |
| 10 | "Nhìn đêm" ở Mật | Làm, tắt được | P28 |
| 11 | Thanh che cựa quậy + hạt nhiễu | Làm | P28 |
| 12 | Cột "Số dư kinh nghiệm" | Làm | P28 |
| 13 | Con dấu "ĐÃ GIẢI MẬT", dòng Nguồn, tài liệu xem trước | Làm | P28 |
| 14 | Chân dung hai độ sáng, Declassify ảnh | Làm sau buổi chụp | P29 |

**Để dành:** Ctrl+K nhảy nhanh; đường di chuyển trên bản đồ; điểm vào riêng từng mật danh.

## 8. Danh sách cắt bỏ (thêm vào `UX-v2.md` mục 6)
- Gậy thần, hào quang tiền tệ, bất cứ hiệu ứng ngụ ý tiền hay may rủi.
- Màn hình "đang tải" giả, thanh phần trăm giả, cổng bắt chờ.
- Cho chọn font tự do; font tải sẵn tất cả hồ sơ.
- Chữ ký tay, làm rối địa chỉ email, biểu mẫu liên hệ cần backend.
- Con trỏ `none`, hiệu ứng con trỏ trên điện thoại, hiệu ứng chạy khi chuột đứng yên.
- Mọi thứ vượt ngân sách ở `docs/performance-playbook.md` mà không làm cảm nhận tốt hơn.

## 9. Nghiệm thu
- Ảnh 375px và 1280px, hai chế độ, vi và en, bốn hồ sơ chữ.
- Bàn phím đi hết trang; reduced-motion; tắt JS vẫn đọc được; cổng bỏ qua được bằng một thao tác.
- Chủ dự án và 3 người lạ trả lời bài thử 5 giây.

## 10. Nhạc nền
Nhạc nền tăng chiều sâu cảm xúc, nhưng âm thanh bất ngờ là lý do thường gặp nhất khiến người xem đóng tab (họ có thể đang ở văn phòng hoặc họp). Vì vậy:
- **Mặc định tắt tiếng**, người xem tự bật bằng công tắc "Âm thanh: TẮT/BẬT" ở cổng và ở bảng "Aa". Trình duyệt vốn chặn phát tiếng khi chưa có thao tác người dùng, và quy chuẩn trợ năng yêu cầu âm thanh tự phát có cách dừng.
- Bấm lens trên cổng **không** tự bật nhạc.
- **Một bài, hai tông:** Mật lọc thông thấp (nghe như qua tường), Declassify mở bộ lọc trong ~500 ms. Âm thanh "giải mật" cùng lúc với giao diện. Đóng lại khi về Mật.
- Âm lượng mặc định thấp (~30%), mờ vào/ra ~800 ms, tạm dừng khi tab ẩn. Không tải trước, không tải khi bật chế độ tiết kiệm dữ liệu.
- Đoạn lặp 60–90 giây, ≤ 2 MB mỗi định dạng, kiểm tra khe hở khi lặp.
- **Giấy phép là điều kiện bắt buộc.** Bản production chỉ có nhạc khi `content/audio.json` có số giấy phép. Không có thì ẩn công tắc. File tải từ YouTube không bao giờ vào bản phát hành.
- Danh sách cắt thêm: nhạc tự phát khi vào trang, nhạc có lời, hiệu ứng âm thanh lặt vặt (tiếng con dấu, tiếng bấm), ảnh bìa album, bất cứ bài nào chưa có giấy phép.
