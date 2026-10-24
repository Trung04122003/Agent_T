# UX — Cupid Dossier

Bổ sung cho `DESIGN.md` (token, chữ) và `SPEC.md` (chức năng). File này mô tả hành vi, chuyển động và cách tạo tò mò. Khi mâu thuẫn: `SPEC.md` thắng về nội dung và riêng tư, `UX.md` thắng về hành vi và chuyển động.

## 1. Nguyên tắc
1. Tò mò đến từ **cách tiết lộ**, không từ việc giấu. Mọi nội dung công khai phải có trong HTML và đọc được khi tắt JavaScript.
2. Ít hiệu ứng, mỗi hiệu ứng có nghĩa. Ba hiệu ứng "chữ ký" (signature), còn lại chỉ là phụ.
3. Mọi hiệu ứng có phương án thay thế: `prefers-reduced-motion`, thiết bị không hover, bàn phím, trình đọc màn hình.
4. Người đang vội phải hiểu trong 10 giây đầu: đây là ai, làm gì, kiểm chứng ở đâu.
5. Không bí ẩn giả (SPEC mục 3). Không đe doạ, không "tối mật tuyệt đối".

## 2. Hành trình người xem
1. **Gate (0 đến 5 giây):** mật danh theo ngôn ngữ cỡ lớn, câu định vị nhỏ, ô chân dung, hai nút nhỏ (ngôn ngữ, chế độ), gợi ý cuộn.
2. **Cửa vào (v1.1):** "Bạn đến với tư cách gì?" gồm Đối tác, Khách hàng, Tò mò. Khi chưa có, Gate cuộn thẳng xuống sổ cái.
3. **Sổ cái:** mỗi hàng gồm mã hồ sơ (01, 02...), khoảng thời gian (monospace, số cùng độ rộng), tổ chức, vai trò, tem trạng thái. Mở hàng để xem tóm tắt và bằng chứng.
4. **Bản đồ bốn điểm.**
5. **Kết:** cách liên hệ nếu chủ dự án chọn, nếu không thì một dòng đóng. Dòng "Hồ sơ cập nhật: tháng/năm" lấy từ ngày build.

## 3. Toggle và hiệu ứng
Chỉ animate `transform`, `opacity`, `clip-path`. Cấm animate `width`, `height`, `top`, `left`.

| Toggle | Hiệu ứng | Thời lượng | Thay thế |
|---|---|---|---|
| **Chế độ Mật ↔ Giải mật** *(signature 1: "Declassify")* | Nút là một con tem lật quanh trục X (`rotateX`). Cảnh đổi chế độ dùng View Transitions với `clip-path: circle()` mở từ vị trí nút. Trong cảnh, các thanh che co về bên trái (`scaleX` 1→0, `transform-origin: left`), so le 30 ms mỗi thanh, tối đa 8 thanh có hiệu ứng, còn lại đổi tức thì; chữ hiện bằng `opacity`. Chân dung chuyển từ đơn sắc tương phản sang màu bằng crossfade. Chiều ngược lại (đóng hồ sơ): thanh phủ lại từ trái sang phải, nhanh hơn, dứt khoát. | Tem 220 ms; cảnh 500 ms (mở), 350 ms (đóng); chân dung 300 ms | Không có View Transitions: crossfade `opacity` 250 ms. Reduced motion: đổi tức thì. Có `aria-live="polite"` đọc "Chế độ Giải mật", không đọc cả trang. Giữ nguyên vị trí focus. |
| **Ngôn ngữ vi ↔ en** *(signature 2: "Decode")* | Mật danh được giải mã: từng ký tự chạy qua tập ký tự cùng hệ chữ rồi chốt về ký tự đúng, chốt lệch nhau 25 ms. Phần còn lại của trang chỉ crossfade; không chạy hiệu ứng giải mã lên đoạn văn dài. | 420 ms (tối đa 16 ký tự); crossfade 200 ms | Hệ chữ RTL hoặc khác Latin (ar, ja): thay bằng quét mặt nạ `clip-path` 300 ms, không xáo ký tự. Reduced motion: đổi tức thì. Cập nhật `lang`, `dir`; `aria-live` chỉ đọc tên mới. |
| **Hướng hồ sơ (lens)** *(v1.1)* | Thẻ được chọn sáng viền accent. Các khối tự sắp xếp lại theo kỹ thuật FLIP (`transform`), tiêu đề nhóm đổi bằng fade. | 150 ms (viền); 350 ms (sắp xếp), so le 30 ms, tối đa 12 khối | Reduced motion: đổi tức thì. URL cập nhật `?lens=`, nút Back hoạt động. |
| **Mở một mục** (và "Xem bản giải mật") | Hàng mở bằng chuyển `grid-template-rows` 0fr → 1fr; thanh che co như trên. Mục `classified`: bấm thì rung nhẹ một lần (`translateX` ±2 px) và hiện "Hồ sơ này không mở theo yêu cầu." Không gợi thêm gì. | 250 ms; rung 120 ms | Reduced motion: không rung, chỉ hiện dòng chữ. |
| **Bản đồ** | Khi cuộn tới (chạy một lần): đường viền vẽ bằng `stroke-dashoffset`; bốn điểm hiện lần lượt, mỗi điểm một nhịp sáng duy nhất; hover hoặc focus hiện nhãn. Không có hiệu ứng lặp vô hạn. Không nối bốn điểm bằng đường, vì như vậy ngụ ý thứ tự di chuyển; chỉ nối khi chủ dự án cung cấp thứ tự. | Viền 900 ms; điểm 120 ms mỗi điểm, nhịp sáng 600 ms; nhãn 150 ms | Reduced motion: hiện sẵn toàn bộ. Có danh sách văn bản thay thế cho trình đọc màn hình. |
| **Mở đầu "Mở hồ sơ"** *(phụ, có thể cắt)* | Lớp phủ mỏng với dòng "ĐANG MỞ HỒ SƠ". Nội dung đã có sẵn trong HTML bên dưới, lớp phủ không chặn gì. | ≤ 700 ms | Bấm hoặc phím bất kỳ để bỏ qua. Chỉ chạy lần đầu mỗi phiên (`sessionStorage` bọc try/catch). Tắt khi reduced motion. |

**Ba hiệu ứng chữ ký:** Declassify, Decode, thanh che (redaction). Hiệu ứng phụ: gạch chân vẽ khi hover, nút nhấn co 0,98, tem trạng thái hiện dần.

**Thứ tự cắt khi không đạt ngân sách hiệu năng:** "Mở hồ sơ" trước, rồi nhịp sáng của bản đồ, rồi so le của lens. Ba hiệu ứng chữ ký giữ đến cùng.

**Không làm ở v1:** con trỏ đèn pin, hạt (particle), parallax, âm thanh, video nền, 3D hoặc WebGL, chữ gõ từng ký tự cho đoạn văn. Lý do: nặng, khó truy cập, và dễ thành sáo.

## 4. Bố cục
- **Thanh điều khiển:** máy tính để ngôn ngữ ở trái, chế độ ở phải. Điện thoại dùng thanh dưới (vùng ngón cái) cao 56 px, có `safe-area-inset`.
- **Gate trên máy tính:** lưới 12 cột, tên 7 cột, chân dung 5 cột. Khung chân dung có bốn dấu đăng ký (dấu cộng ở góc, vẽ bằng CSS). Điện thoại xếp dọc: chân dung (tỉ lệ 4:5) rồi tên.
- **Chất liệu:** nền đen có hạt rất mịn (một ảnh nhiễu nhỏ lát đều, tĩnh, độ mờ thấp, không animate), đường kẻ mảnh màu đồng thau, số cùng độ rộng (`tabular-nums`) ở mọi con số. Chất quân đội đến từ mã hồ sơ, nhãn phân loại và dấu đăng ký. Chất tài chính đến từ bố cục sổ cái và tem đã kiểm chứng. Không dùng hoạ tiết sao, súng hay quân hàm.
- **Tem trạng thái:** "Đã kiểm chứng" là dấu kiểm toán. Mục chưa kiểm chứng chỉ hiện ở dev.
- **In ấn:** `@media print` ép về Giải mật, ẩn nút, gọn một trang. Đối tác cần bản PDF thì in ra là có một CV sạch.
- **Khi tắt JS:** thấy toàn bộ nội dung công khai ở dạng tĩnh, không có nút đổi chế độ.

## 5. Chân dung
Quyết định về ảnh còn mở. Ý tưởng thiết kế: **chế độ đổi thì khuôn mặt đổi.** Mật là đơn sắc, tương phản cao, nửa mặt trong bóng. Giải mật là ảnh màu, rõ nét, có nụ cười. "Giải mật con người" khớp đúng chủ đề, và không giả vì khuôn mặt thật có ở chế độ sáng.

Hai ảnh đã nhận chưa dùng được ngay:
- **Ảnh đứng cạnh quốc kỳ và quốc huy nước ngoài:** hợp tông (vest đen, sơ mi trắng) nhưng lá cờ và quốc huy chiếm khung, gửi một tín hiệu địa chính trị trái với quy tắc "không chính trị" và gợi ra vòng tiếp xúc ngoại giao. Ảnh dọc, mặt nhỏ nên cắt chân dung sẽ thiếu độ phân giải.
- **Ảnh cười, giơ hai ngón tay:** ấm áp, mặt rõ, nhưng trái hẳn tông bí ẩn, và nền có chữ in trên ghế mang tên một trường khác.

**Khuyến nghị:** chụp mới một buổi, gồm ba kiểu: (1) nghiêm, ánh sáng cạnh bên, cho Mật; (2) mỉm cười nhẹ, cho Giải mật; (3) một cận cảnh chi tiết (kính, tay áo) làm chất liệu. Yêu cầu: nền tối trơn, không cờ, không logo, không chữ, trang phục đen, tỉ lệ 4:5, cạnh dài ≥ 2000 px, định dạng JPEG chất lượng cao hoặc RAW.

Quy tắc kỹ thuật:
- Chưa đưa ảnh nào vào repo cho đến khi chủ dự án chọn. Giai đoạn đầu dùng ảnh giữ chỗ trung tính.
- Mọi ảnh phải đi qua pipeline build và **xoá metadata (EXIF, GPS)**. `check-leaks` phải kiểm tra điều này trên `dist/`.
- Component chân dung nhận hai ảnh (`mat`, `giai-mat`) và chỉ dựng được khi cả hai có `alt` ở `vi` và `en`.

## 6. Microcopy
| Ý | vi | en |
|---|---|---|
| Chế độ tối | Mật | Classified |
| Chế độ sáng | Giải mật | Declassified |
| Mở một khối che | Xem bản giải mật | View declassified |
| Trạng thái | Đã kiểm chứng | Verified |
| Loại hồ sơ che | Bảo mật theo nghề | Confidential by profession |
| Bấm vào mục classified | Hồ sơ này không mở theo yêu cầu. | This file is not open by request. |
| Gợi ý Gate | Cuộn để mở hồ sơ | Scroll to open the file |
| Cửa vào | Bạn đến với tư cách gì? | In what capacity are you here? |
| Ba hướng | Đối tác · Khách hàng · Tò mò | Partner · Client · Curious |
| Nhãn khung chân dung | Hồ sơ cá nhân | Personal file |

Giọng điệu: câu ngắn, bình tĩnh. Bản `en` do người thật duyệt, không để máy dịch nguyên văn.

## 7. Truy cập và thiết bị
- Thứ tự Tab theo thứ tự đọc. Vòng focus 2 px màu accent, có khoảng cách. Vùng bấm ≥ 44 px.
- Khối che có `role="img"` và `aria-label` chỉ là nhãn loại (ví dụ "Nội dung bảo mật theo nghề"). Tuyệt đối không có chữ thật trong nhãn.
- Màu không phải kênh duy nhất truyền thông tin (tem có chữ, không chỉ có màu).
- `forced-colors`: khối che vẫn thấy được nhờ viền.
- Không thông tin nào chỉ hiện khi hover.
- Tôn trọng `prefers-reduced-motion` và `Save-Data`.

## 8. Nghiệm thu UX
- Mỗi toggle có test e2e: trạng thái đổi đúng, `aria-live` đọc đúng, reduced motion đổi tức thì (thời lượng đo được bằng 0), focus không mất.
- Chủ dự án duyệt bằng mắt, trên máy thật (máy tính và điện thoại), ở ba điểm dừng: sau Gate, sau lớp chuyển động, trước phát hành. Chi tiết ở `ROADMAP.md`.
- Ngân sách hiệu năng ở `SPEC.md` mục 10. Không đạt thì cắt theo thứ tự ở mục 3.
