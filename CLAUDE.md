# Cupid Dossier — hướng dẫn cho Claude Code

Trang web cá nhân của Lê Thái Trung (mật danh Cupid). Đọc `SPEC.md` trước khi làm bất cứ việc gì. Đọc `UX.md` và `DESIGN.md` khi đụng đến giao diện, `ROADMAP.md` để biết đang ở phase nào.

@docs/dev-discipline.md

## Ghi đè mặc định của dev-discipline (dự án này thắng, trừ mục 5 của skill)
- Không có database, không MySQL, không backend. Nội dung là file trong `content/`.
- Site tĩnh. Hiện không cần biến môi trường. Nếu sau này cần, tuân thủ mục 5.
- Trình quản lý gói: pnpm. Mọi script phải chạy được trên Windows 11 (không dùng lệnh chỉ có ở bash).
- Nói chuyện với chủ dự án bằng tiếng Việt. Code, tên biến, comment, commit: tiếng Anh.

## Quy tắc cứng về riêng tư (không bao giờ nhường)
1. Chỉ nội dung trong `content/` mới được lên site. Không tự thêm sự kiện, chức danh, con số hay ngày tháng. Thiếu dữ liệu thì để `null` và hỏi chủ dự án.
2. Mục `visibility: "hold"` không được biên dịch vào bản build. Mục `classified` chỉ xuất nhãn loại, không xuất văn bản gốc (schema phải cấm).
3. Không đưa vào repo hay site: số điện thoại, địa chỉ nhà, ngày sinh đầy đủ, thông tin liên lạc cá nhân, thông tin của bên thứ ba.
4. Trước khi báo "xong" một phase phải chạy `pnpm check:leaks` và đọc kết quả.
5. Không commit, không push, không deploy trừ khi chủ dự án yêu cầu. Nếu push lên GitHub thì repo phải private.

## Lệnh
`pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm test` · `pnpm e2e` · `pnpm check:leaks`

Các lệnh này được tạo ở phase P0. Đừng giả định chúng đã tồn tại trước đó.

## Quy trình
Mỗi phiên làm đúng một phase trong `ROADMAP.md`, theo từng dòng `step -> verify`, và dừng ở Checkpoint chờ chủ dự án. Cuối phiên báo cáo theo mục 6 của dev-discipline.
