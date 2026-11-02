# DECISIONS v4 — "Thành phố Agent T" (quyết định của chủ dự án, 02/11/2026)

> Bản tiếng Việt để chủ dự án đọc. **Bản gốc cho Claude Code là `DECISIONS-v4.md` (tiếng Anh); nếu hai bản lệch nhau thì theo bản tiếng Anh.**

Đọc cùng `ROADMAP-v4.md` và `UX-v4.md`. Quy tắc ngôn ngữ: nói chuyện với chủ dự án bằng **tiếng Việt**; code, tên biến, comment, commit và tài liệu trong `docs/city/` bằng **tiếng Anh**. Chữ hiển thị trên site có hai thứ tiếng (vi/en) như mọi nơi khác và phải qua `check:locales`.

## Chủ dự án đã quyết định (02/11/2026)
1. **Làm một tầng thứ hai: thành phố đặc vụ 2.5D tên "Thành phố Agent T".** Dossier đã xong vẫn là bản chính. Thành phố là cách vào khám phá tùy chọn, dùng cùng nội dung.
2. **2.5D**, không phải 3D đầy đủ (máy chuẩn là Intel i3-1115G4, RAM 8 GB, đồ họa tích hợp; chủ dự án cũng không vẽ được, nên mọi thứ sinh ra từ code, không vẽ tay).
3. **Ý tưởng: "thành phố đặc vụ trừu tượng" kèm bản đồ thật của Việt Nam bên trong.** Chủ dự án đã xác nhận ngày 02/11/2026: bản đồ là **Atlas**, một bàn bản đồ nổi dạng hình nổi ở quảng trường trung tâm, kèm một cột sáng trên Đà Nẵng.
4. **Làm cho hoành tráng, đậm chất đặc vụ, và nhân vật Agent T phải độc lạ, nhìn là biết đặc vụ.** Chủ dự án duyệt tham vọng này. Chất lượng quan trọng hơn số lượng: ít thứ, mỗi thứ làm cho ra trò.
5. **Ánh sáng và bóng tối chính là tiến trình của bản đồ.** Thành phố ban đêm = Mật. Thành phố lúc bình minh = Giải mật. Mỗi hồ sơ được giải mật thì sáng lên.
6. **Claude Code được tự do sáng tạo** trong các giới hạn dưới đây. Mỗi thứ sáng tạo phải được ghi lại (xem "Quyền sáng tạo").

## Quyền sáng tạo (Claude Code được tự quyết)
Kiến trúc tòa nhà, hình khối, ánh sáng, hoạt ảnh, hạt, âm thanh tạo bằng code, phong cách HUD, tên tòa nhà và mật danh khu phố, và **chữ tạo không khí** (câu ngắn gợi bối cảnh).
Điều kiện:
- Ghi từng thứ sáng tạo vào `docs/city/creative-log.md` (là gì, vì sao, ảnh chụp, cách tắt). Chủ dự án có thể bác bất cứ thứ gì.
- Chữ tạo không khí **không được khẳng định sự thật nào về chủ dự án** và không được nêu điều gì không có trong `content/`. Sự thật chỉ đến từ đường ống nội dung đã lọc. Soạn các câu này bằng skill humanizer; liệt kê hết trong `docs/city/copy-review.md` để chủ dự án duyệt trước khi phát hành.
- Thêm thư viện mới, font mới, họ màu mới hoặc yêu cầu mạng mới: **hỏi trước**.

## Giới hạn cứng (không đổi, thắng mọi sáng tạo)
- Không có bất cứ điều gì về vai trò trợ lý bí mật nêu ở DECISIONS-v3, dưới mọi hình thức (không tòa nhà, không thanh che, không gợi ý).
- Không chính trị hay địa chính trị, trừ bản đồ chủ quyền đã duyệt: **Hoàng Sa và Trường Sa được ghi "(Việt Nam)" đúng như bản đồ hiện có**, miễn trừ khỏi sương mù, thanh che và hiệu ứng mờ dần. Không gõ lại các nhãn này: lấy từ cùng nguồn với bản đồ 2D và thêm bài test báo lỗi nếu chúng khác nhau hoặc biến mất. Không vẽ bất kỳ đường nào trên biển.
- Không logo hay huy hiệu của tổ chức thật (kể cả Prudential), không số liệu giả, không chữ nào ngụ ý hiệu suất đầu tư, không chữ ký tay, không trang phục mang hơi hướng quân đội trên nhân vật.
- Mục `hold` không bao giờ được biên dịch. Thành phố chỉ đọc **dữ liệu build đã lọc** mà sổ cái dùng. Tính đến 02/11/2026: vai trò DFL24 IC đã xóa; Prudential đã duyệt và hiện lên; mục `classified` chỉ hiện nhãn loại.
- Chỉ các địa chỉ trong allowlist rò rỉ mới được xuất hiện (email công việc cho "Yêu cầu giải mật"). Không phương thức liên hệ mới, không biểu mẫu, không backend, không analytics ngoài phần đo cục bộ đã duyệt, không cookie.
- Không nơi chốn riêng tư: Atlas chỉ hiện các nơi đã có trong `content/places.json`.
- Nhạc: không đưa lên bản phát hành thứ nhạc chưa có giấy phép. Hiệu ứng âm thanh tạo bằng Web Audio (không dùng file mẫu) thì được. Mặc định tắt tiếng.
- Claude Code không bao giờ commit, push hay deploy trừ khi chủ dự án yêu cầu.

## Ràng buộc từ codebase hiện tại (kiểm tra, đừng giả định)
- Lối vào từ cổng phải tốn **0 B JS** (thẻ `<a href>` thường): trần JS của cổng đã đặt ở 3,2 KB ngày 01/11/2026.
- Dùng lại, đừng viết lại: `src/lib/map.ts` (hình học lúc build, nhãn, quần đảo), `src/scripts/map-3d.ts` (độ nghiêng và độ cao ruộng bậc thang), `src/scripts/mode.ts`, `src/scripts/declassify.ts`, logic lens ở `src/lib/lens.ts` và `content/lenses.json`, bậc bằng chứng ở `src/lib/evidence.ts`.
- `d3-geo`, `topojson-*` là devDependencies: hình học phải sinh lúc build và gửi đi dưới dạng dữ liệu.
- Phase phát hành của v3 (P30) chưa xong. Thành phố **không được chặn nó**: nếu chủ dự án muốn thì phát hành dossier trước. Route thành phố nằm sau một cờ build cho tới khi chủ dự án duyệt (ROADMAP-v4 P31, P52).

## Việc còn mở cho chủ dự án (không chặn P31)
- Duyệt mật danh các khu phố và chữ tạo không khí (P37, P52).
- Tìm ảnh trên mạng theo bóng dáng Agent T để xem có giống ai không (checkpoint P43).
- Thử thành phố trên điện thoại thật, kể cả trình duyệt trong app (P49).
- Quyết định thành phố có nằm trong bản phát hành đầu tiên hay ra sau (P52).
