# UX v2 — Mật (quân đội) ↔ Giải mật (tài chính)

Bổ sung cho `UX.md` và `DESIGN.md`. Điểm khởi đầu để chủ dự án duyệt bằng mắt, không phải bản chốt.

## 0. Nguyên tắc chống "nhạt" và chống "lòe loẹt"
Hai nỗi sợ của chủ dự án: đơn giản mà thiếu sức hút, và phức tạp mà quá màu mè. Quy tắc cân bằng:
- **Một điểm nhấn mỗi màn hình.** Phần còn lại phải tĩnh và sạch.
- **Một màu nhấn** (đồng thau). Không thêm màu thứ hai làm trang trí.
- **Sức hút đến từ chi tiết thật, không từ hiệu ứng:** mã hồ sơ, số tabular, đường kẻ mảnh, con dấu, biểu đồ từ dữ liệu thật.
- **Mật dày đặc về không khí, ít chữ. Giải mật dày đặc về số liệu, nhiều chữ hơn.** Hai chế độ khác nhau ở *mật độ*, không chỉ khác màu.
- Thử nghiệm: bỏ hiệu ứng đó đi, trang có kém hơn không? Không thì bỏ.

## 1. Ngân sách chuyển động
- Tối đa 1 hiệu ứng nổi bật mỗi màn hình, tối đa 2 hiệu ứng chạy đồng thời.
- Chỉ `transform`, `opacity`, `clip-path`. Mỗi hiệu ứng ≤ 600 ms. Không lặp vô hạn.
- Mọi thứ tắt khi `prefers-reduced-motion`.

## 2. Công tắc ngôn ngữ bằng quốc kỳ
**Vấn đề thật cần biết trước:**
- Emoji cờ **không hiển thị trên Windows** (chỉ ra hai chữ "VN"). Bắt buộc dùng SVG tự lưu trữ.
- Cờ là quốc gia, không phải ngôn ngữ. Tiếng Anh nên dùng cờ Anh hay Mỹ? Tiếng Ả Rập dùng cờ nước nào? Chủ dự án đã quy định không đưa chính trị lên site, nên **chọn cờ là quyết định của chủ dự án**, không phải của Claude Code.
- Cờ không đủ cho người dùng trình đọc màn hình, nên luôn kèm mã chữ (VI, EN) và `aria-label` ("Tiếng Việt", "English").

**Thiết kế:**
- Nhóm nút nhỏ ở góc trên: cờ bo tròn nhẹ 20×14 px + mã chữ monospace. Nút đang chọn có viền đồng thau và `aria-current`.
- Giai đoạn đầu chỉ VI và EN. Ngôn ngữ khác chỉ xuất hiện khi nội dung dịch đầy đủ (script kiểm tra lúc build).
- Hover/focus: cờ nhích lên 1 px, không hiệu ứng khác. Giữ Decode của mật danh khi đổi.
- Là liên kết thật tới URL ngôn ngữ để chạy được khi tắt JS.

## 3. Hệ thống hình ảnh
| | Mật | Giải mật |
|---|---|---|
| Ẩn dụ | Bàn điều hành, hồ sơ phân loại | Màn hình dữ liệu, sổ cái |
| Nền | Đen, lưới đường kẻ cực mảnh | Sáng, đường kẻ mảnh |
| Chữ | Monospace là chủ đạo ở nhãn | Số tabular ở mọi con số |
| Mật độ | Thấp, nhiều khoảng trống | Cao hơn ở khối số liệu |
| Điểm nhấn | Dải phân loại, thanh che, con dấu | Biểu đồ cam kết, nhãn bằng chứng |
| Đường nét | Khung góc kiểu ống ngắm | Đường kẻ ngang kiểu bảng giá |

Chi tiết cần dùng chung ngôn ngữ chứ không dùng nhãn hiệu thật. Không logo, con dấu hay huy hiệu của cơ quan nào.

## 4. Biểu đồ cam kết ("dòng tiền" nhưng không phải tiền)
Ý tưởng: biểu đồ bậc thang cho thấy **số cam kết đồng thời theo thời gian** từ 2021 đến nay, tính từ `period` trong sổ cái. Nó có dáng đồ thị chứng khoán nhưng chỉ kể một sự thật: bạn gánh bao nhiêu việc, vào lúc nào.
- Giải mật: có nhãn năm, rê chuột hiện tên mục, đường nét đồng thau.
- Mật: cùng dữ liệu, vẽ như tín hiệu, nhãn bị che bằng thanh đen. Khi Declassify, nhãn hiện ra.
- Lưu ý: không đặt trục tiền hay tỷ lệ phần trăm; Prudential là lĩnh vực quản lý chặt quảng cáo tài chính, nên tuyệt đối không ngụ ý hiệu suất đầu tư.

## 5. Mười bốn ý tưởng (kèm quyết định)
| # | Ý tưởng | Quyết định | Phase |
|---|---|---|---|
| 1 | Công tắc ngôn ngữ bằng cờ SVG + mã chữ | Làm | P10 |
| 2 | BLUF một dòng cho mỗi mục sổ cái | Làm | P11 |
| 3 | Bậc bằng chứng T1/T2/T3 tính tự động | Làm | P9 |
| 4 | Cổng phê duyệt cho tổ chức cần duyệt (Prudential, DFL24) | Làm | P9 |
| 5 | Dải phân loại chung ở đầu trang | Làm | P13 |
| 6 | Mã hồ sơ, DTG, số trang | Làm | P13 |
| 7 | Con dấu khi mở dòng | Làm | P13 |
| 8 | Khung góc "ống ngắm" ở ảnh và bản đồ | Làm | P13 |
| 9 | Số tabular, lưới đường kẻ mảnh ở Giải mật | Làm | P14 |
| 10 | Khối 3–5 con số đầu trang tính từ content | Làm | P14 |
| 11 | Biểu đồ cam kết hai cách vẽ | Làm | P15 |
| 12 | Declassify v2 (thanh co lại + đường biểu đồ hiện dần) | Làm | P16 |
| 13 | Tear sheet, AAR, Giới hạn và rủi ro | Làm khi có nội dung | P17 |
| 14 | Hồ sơ một trang để in/PDF | Làm | P18 |

**Để dành, chưa làm:** đường di chuyển giữa các nơi trên bản đồ (Thái Nguyên, Hà Nội, Đà Nẵng, Điện Bàn); thanh tìm nhanh Ctrl+K; điểm vào riêng cho từng mật danh.

## 6. Danh sách cắt bỏ
Không làm, kể cả khi chủ dự án hay Claude Code nghĩ ra sau này:
- Dải chạy chữ liên tục (ticker) và mã cổ phiếu thật.
- Mưa ký tự, hiệu ứng CRT/nhiễu mạnh, vệt con trỏ, âm thanh tự phát.
- Màu đỏ/xanh làm tín hiệu duy nhất; thêm màu nhấn thứ hai.
- Logo, con dấu, huy hiệu cơ quan thật.
- Số liệu minh họa, "lợi nhuận", "tăng trưởng", phần trăm không truy được về `content/`.
- Hiệu ứng nào làm trang chậm quá ngân sách trong `SPEC.md` mục 10.

## 7. Nghiệm thu
- Ảnh chụp 375px và 1280px, hai chế độ, ngôn ngữ vi và en.
- Chủ dự án trả lời được: "Có thứ nào làm mình muốn đóng trang không?" Nếu có thì cắt.
- WCAG AA, bàn phím, `prefers-reduced-motion`, tắt JS vẫn đọc được nội dung.
