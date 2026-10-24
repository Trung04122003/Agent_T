# DESIGN — Cupid Dossier

Điểm khởi đầu, không phải bản chốt. Claude Code đề xuất, chủ dự án duyệt bằng mắt ở P1 và P2 (xem `ROADMAP.md`).

## Tinh thần
Quân đội: hồ sơ, cấp độ, nhãn phân loại, kỷ luật. Tài chính: sổ cái, số liệu, sự tiết chế. Màu đen là chủ đạo. Giọng điệu ít chữ, chắc, không phô trương. Càng ít nói càng giống thật.

## Hai chế độ (cùng cấu trúc, khác bề mặt)
Dùng CSS custom properties trên `:root[data-mode="mat"]` và `:root[data-mode="giai-mat"]`. Giá trị dưới đây là điểm bắt đầu, phải được script kiểm tra tương phản WCAG AA.

| Token | Mật (tối) | Giải mật (sáng) |
|---|---|---|
| `--bg` | `#0A0A0B` | `#F3F1EA` |
| `--surface` | `#131316` | `#FFFFFF` |
| `--ink` | `#E8E6E1` | `#111111` |
| `--ink-muted` | `#9C9A94` | `#55534E` |
| `--line` | `#26262B` | `#D9D6CC` |
| `--accent` | `#B8975A` (đồng thau) | `#7A5F2A` |
| `--redact` | `#000000` trên nền `--surface` | `#111111` |

Màu nhấn dùng rất tiết kiệm (nhãn cấp độ, đường kẻ chính, điểm trên bản đồ).

## Chữ
- Ba vai trò: tiêu đề (serif đậm tương phản), thân bài (sans dễ đọc), nhãn/hồ sơ (monospace).
- Ứng viên cần kiểm tra: Playfair Display, Be Vietnam Pro, IBM Plex Mono, đều cần có tập con tiếng Việt. Claude Code **phải render thử** chuỗi dấu ở SPEC mục 7 trước khi chọn. Tối đa 2 họ phông trong bản cuối.
- Tự lưu trữ (ví dụ qua gói fontsource), không gọi CDN lúc chạy.

## Khối che (redaction)
- Thanh đen đặc, bo nhẹ hoặc vuông góc, chiều cao bằng dòng chữ.
- Độ dài ngẫu nhiên theo lần build (hạt giống cố định trong build để ổn định giữa các lần tải).
- Có nhãn loại (monospace, nhỏ, chữ hoa) và liên kết "Xem bản giải mật".
- Chuyển cảnh Mật → Giải mật: các thanh co lại và chữ hiện lên bằng `opacity`, tối đa 400 ms. Với `prefers-reduced-motion` thì đổi tức thì.

## Bố cục
- Một cột chính, rộng tối đa khoảng 70 ký tự cho phần chữ. Lưới 8 px.
- Gate (Cấp 0) chiếm trọn màn hình đầu: tên/mật danh, câu định vị, nút chế độ. Không thêm gì khác.
- Timeline dọc, mốc thời gian dạng số monospace, mỗi mục một thẻ.
- Dùng được trên điện thoại với lề 16 px, không cuộn ngang.

## Chuyển động
Quy tắc chi tiết, hiệu ứng từng toggle, thời lượng và phương án thay thế nằm ở `UX.md` mục 3. Tóm tắt: chỉ animate `transform`, `opacity`, `clip-path`; tắt toàn bộ khi `prefers-reduced-motion`.

## Giọng văn
Câu ngắn, chủ động, không tính từ khoe khoang, không viết hoa để gây ấn tượng. Tránh văn mẫu và khẩu hiệu. Mọi chuỗi phải có cả `vi` và `en`, bản `en` do người thật duyệt, không để máy dịch nguyên văn.
