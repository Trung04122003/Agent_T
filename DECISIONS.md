# DECISIONS — quyết định của chủ dự án (25/10/2026)

Claude Code dùng file này khi làm P9 và P10. Mọi chữ dưới đây do chủ dự án cung cấp hoặc duyệt. Không tự thêm ý.

## Ngôn ngữ và cờ (P10)
- Tiếng Anh dùng **cờ Anh**. Tiếng Việt dùng cờ Việt Nam.
- Chỉ VI và EN ở giai đoạn đầu.

## Bluesea Food (P9.5)
- Sự thật: vai trò nhân viên kinh doanh đang tạm dừng; việc chăm sóc khách hàng hiện có vẫn được duy trì.
- `period`: từ 2025-06, `ongoing: true`.
- **Không đăng kế hoạch quay lại 2027** (chưa phải sự thật, chủ dự án chưa yêu cầu đăng).
- Không dùng chữ "ngầm" trên site.
- Câu chữ đề xuất (chờ chủ dự án duyệt lần cuối):
  - title vi: "Kinh doanh (tạm dừng vai trò)" · en: "Sales (role on pause)"
  - teaser (Mật) vi: "Công ty gia đình. Vai trò kinh doanh đang tạm dừng." · en: "Family company. Sales role currently paused."
  - summary (Giải mật) vi: "Công ty phân phối thực phẩm của gia đình, phục vụ khách sạn, nhà hàng và quán cà phê tại Đà Nẵng – Hội An. Vai trò kinh doanh tạm dừng; việc chăm sóc khách hàng hiện có vẫn được duy trì." · en: "Family-owned food distributor serving hotels, restaurants and cafés in Da Nang and Hoi An. The sales role is paused; care for existing customers continues."

## Prudential (P9.5, P9.6)
- Sự thật: chủ dự án **vẫn đang làm** ở Prudential. Dùng `ongoing: true`, bỏ ngày kết thúc 2027-06.
- Vẫn nằm ở `hold` cho đến khi có `approval: { by, on }` (chủ dự án chưa xác nhận đã được Prudential cho phép đăng).
- Câu chữ đề xuất: title vi "Tư vấn viên bảo hiểm" · en "Insurance advisor"; org "Prudential Việt Nam"; teaser/summary chỉ nêu vai trò và văn phòng Ngũ Hành Sơn, **không** nêu số liệu, sản phẩm, hiệu quả, lợi ích bảo hiểm.

## Vẫn cấm tuyệt đối trên site
- Bất cứ điều gì về vai trò trợ lý cho thầy Cường / FBV, dưới mọi hình thức (kể cả thanh che).
- Chính trị, địa chính trị (trừ bản đồ chủ quyền Hoàng Sa, Trường Sa đã duyệt).

## Chuyển cảnh Giải mật v2 (P16.1)
- Chủ dự án chọn (27/10/2026): giữ đủ hiệu ứng (lật dấu, mờ ảnh chân dung, dải phân loại, đường biểu đồ, thanh che) và cho thanh che co chậm để thấy được (mỗi thanh 280 ms, nối nhau 25 ms).
- Cảnh dài 720 ms, khoảng 800 ms tính từ cú bấm. Đây là ngoại lệ so với mức "tổng ≤ 600 ms" của ROADMAP 16.1.
- Vẫn giữ tối đa 2 hiệu ứng chạy cùng lúc; chỉ animate transform, opacity, clip-path.
