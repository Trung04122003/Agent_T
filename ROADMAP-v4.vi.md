# ROADMAP v4 — Thành phố Agent T (P31–P52)

> Bản tiếng Việt để chủ dự án đọc. **Bản gốc cho Claude Code là `ROADMAP-v4.md` (tiếng Anh); nếu hai bản lệch nhau thì theo bản tiếng Anh.**

Đọc trước: `DECISIONS-v4.md` (chủ dự án đã quyết gì và các giới hạn cứng), `UX-v4.md` (cảm giác mong muốn), `docs/performance-playbook.md` (cách đo), `CLAUDE.md` (quy tắc riêng tư). Nói chuyện với chủ dự án bằng tiếng Việt; mọi thứ khác bằng tiếng Anh.

## Quy tắc cho mọi phase
1. **Mỗi phiên một phase**, đi từng bước theo `step -> verify`, rồi dừng ở Checkpoint chờ chủ dự án. Báo cáo theo mục 6 của dev-discipline.
2. **Dossier là bản chính.** Thành phố chỉ đọc dữ liệu build đã lọc mà sổ cái dùng. Không bao giờ đọc `content/claims.json` thô trong code thành phố. Không thêm mục, ngày, số liệu hay chức danh mới.
3. **Đo trước.** Dùng `pnpm build:prod` + `pnpm preview`, không bao giờ dùng `pnpm dev` để lấy số hiệu năng. Ghi số trước/sau vào `docs/perf-log.md`. Máy sàn chuẩn là máy Intel i3-1115G4 / 8 GB / đồ họa tích hợp của chủ dự án. Đóng các ứng dụng nặng khác, mỗi lần chạy một công cụ nặng, lấy trung vị của 3 lần.
4. **Ngân sách (không hạ, muốn đổi thì hỏi):**
   - JS của route thành phố ≤ 80 KB gzip tổng (nạp lười, chỉ ở `/city/`). Dữ liệu Atlas ≤ 60 KB gzip. CSS thành phố ≤ 8 KB gzip. Không có tài nguyên ảnh nào (mọi thứ sinh bằng code). Không font mới.
   - Trang dossier: +0 B JS và không có yêu cầu mạng nào do thành phố gây ra. Lối vào là thẻ liên kết thường. Trần JS của cổng giữ ở 3,2 KB.
   - Thời gian khung p95 ≤ 20 ms trên máy i3 ở mức **Vừa**; ≤ 40 ms khi giảm CPU 4× sau khi tự hạ mức. Khung đầu tiên được vẽ ≤ 1,5 giây sau DOM ready (build:prod, preview) và ≤ 4 giây khi giảm CPU 4×.
   - Bộ nhớ: tổng bộ đệm canvas ≤ 64 MB; heap JS tăng ≤ 15 MB sau 10 phút đi bộ và nghỉ; số listener không tăng.
   - Một vòng `requestAnimationFrame`. Tạm dừng khi `document.hidden`. Chuyển động nền khi nghỉ ≤ ~20 fps sau 20 giây không thao tác. Không `backdrop-filter`, không `filter` của canvas, không gradient lớn vẽ lại mỗi khung.
5. **Không thêm thư viện, font, họ màu hay yêu cầu mạng mới nếu chưa hỏi.** Chỉ Canvas 2D và TypeScript thuần. Nếu thấy cần thư viện, viết phép đo chứng minh rồi hỏi.
6. **Quyền sáng tạo** (xem DECISIONS-v4): tự quyết về diện mạo và cảm giác, ghi mỗi thứ sáng tạo vào `docs/city/creative-log.md` kèm ảnh chụp và cách tắt.
7. **Mỗi phase kết thúc bằng:** `pnpm typecheck`, `pnpm test`, `pnpm check:contrast`, `pnpm build`, `pnpm check:leaks` (cộng `pnpm e2e` ở phase nào thêm luồng mới), và số đo cho ngân sách của phase. Đọc kết quả, đừng giả định.
8. **Khoảnh khắc đặc trưng:** mỗi Hồi phải để lại ít nhất một khoảnh khắc trong mục 11 của UX-v4 chạy được và sẵn sàng chụp ảnh cho chủ dự án.
9. Ảnh để chủ dự án duyệt: từ P35 trở đi, xuất ảnh chụp vào `docs/city/review/<phase>/` (camera cố định, cả hai chế độ) để chủ dự án đánh giá mà không cần chạy gì. Nếu là chuyện gu thẩm mỹ, đưa hai phương án thay vì hỏi chung chung.
10. Nếu một tính năng vượt ngân sách sau khi tối ưu hợp lý, cắt theo thứ tự ở mục 14 của UX-v4. Không bao giờ hạ ngân sách.

## Hồi 0 — Hiến chương và nền móng

### P31 — Hiến chương, bản đồ nội dung, bộ đo ngân sách
Mục tiêu: biến các quy tắc thành thứ chạy được trước khi có bất kỳ điểm ảnh nào.
- 31.1 Tạo `docs/city/CHARTER.md`: phạm vi, những thứ không làm (không nhiều người chơi, không backend, không lưu người xem, không analytics, không engine 3D), các giới hạn cứng chép nguyên văn từ DECISIONS-v4. -> verify: file có đó, chủ dự án đọc trong hai phút.
- 31.2 Tạo `docs/city/content-map.md` bằng cách đọc dữ liệu dossier **đã lọc** (cùng bộ nạp với sổ cái): mỗi mục mở một dòng (id, kind, domain, tier, place), thêm mục `classified` thành Hầm, thêm những component dossier hiện có (sổ cái, AAR, risks, ma trận năng lực, chuỗi truy nguồn, yêu cầu giải mật). Không viết cứng các mục vào code thành phố. -> verify: một bài test báo lỗi nếu có mục nằm trong sổ cái mà không có lô đất, hoặc nếu id `hold` xuất hiện ở bất kỳ đâu trong dữ liệu thành phố.
- 31.3 Thêm cờ build `PUBLIC_CITY` (mặc định tắt ở `build:prod`, bật ở dev). Khi tắt, `/[lang]/city/` không được sinh ra và không trang dossier nào liên kết tới. -> verify: test cho thấy `dist/` không có route `city` và không có liên kết city khi cờ tắt.
- 31.4 Đường cơ sở: chạy playbook hiệu năng trên dossier hiện tại trên máy i3 và ghi số liệu (báo cáo dung lượng, Lighthouse, khung hình). -> verify: số liệu nằm trong `docs/perf-log.md`.
- 31.5 Script `pnpm city:budget`: báo lỗi khi JS thành phố, dữ liệu Atlas hoặc CSS vượt ngân sách ở trên, và khi bất kỳ file nào trong gói thành phố là ảnh hoặc font. -> verify: chạy với một bản stub cố ý quá cỡ, rồi xóa stub.
- 31.6 Mở rộng `check:leaks`: quét đầu ra route thành phố tìm chuỗi bị cấm (danh sách hiện có), email khác ngoài email trong allowlist, id hold, mẫu số điện thoại. -> verify: ca lỗi cố ý được bắt.
Checkpoint: chủ dự án đọc hiến chương. (Cách hiểu Atlas đã được xác nhận ngày 02/11/2026: bản đồ là một bàn hình nổi ở quảng trường kèm cột sáng, không phải cả thành phố nằm trên hình chữ S.)

### P32 — Lõi engine thế giới (chưa có hình)
- 32.1 `src/city/engine/iso.ts`: phép chiếu isometric 2:1, phép chiếu ngược để chọn điểm, hàm hỗ trợ sắp xếp độ sâu. -> verify: unit test, vòng đi–về sai số dưới 1e-6 trên một lưới điểm.
- 32.2 Vòng lặp: một rAF, kẹp delta, tạm dừng khi ẩn, giảm tốc khi nghỉ, bộ đếm fps chỉ cho dev. -> verify: test với fake timer; thủ công: không có hoạt động rAF trong tab ẩn (vết Performance).
- 32.3 Chồng lớp: lớp tĩnh nướng sẵn (canvas ngoài màn hình, chia mảnh), lớp bóng tối (nửa độ phân giải), lớp động, lớp HUD bằng DOM. DPR bị chặn để tổng bộ đệm dưới 64 MB. -> verify: nhật ký kích thước canvas ở 1366x768 và 1920x1080.
- 32.4 Các mức chất lượng với bộ tự hạ mức theo trung bình trượt (không bao giờ tự nâng lại trong một phiên) và nút thủ công. -> verify: unit test bộ điều khiển; giảm CPU 4× và xem nó hạ mức đúng một lần.
- 32.5 Lớp trừu tượng đầu vào: bàn phím, con trỏ, cảm ứng, một đường sự kiện duy nhất với listener passive; rect được lưu sẵn, không đọc layout trong vòng lặp. -> verify: không có `getBoundingClientRect` trong vòng lặp (quy tắc lint hoặc test grep).
- 32.6 Kiểm tra khả năng (`canvas 2d`, `matchMedia(prefers-reduced-motion)`, `navigator.deviceMemory` nếu có, `saveData`) quyết định Cao/Vừa/Thấp/Lite. -> verify: unit test dạng bảng.
Checkpoint: cảnh trống giữ 60 fps trên máy i3; chủ dự án chưa thấy gì, và thế là ổn.

### P33 — Route, lối vào, lối ra, khung dự phòng
- 33.1 Route `/[lang]/city/` (có cờ), `noindex`, canonical về dossier. -> verify: test HTML.
- 33.2 Liên kết lối vào (thẻ liên kết thường) ở cổng và đầu trang dossier, mang theo `?lens=` và ngôn ngữ. -> verify: kích thước JS của cổng không đổi (test từng byte so với trần 3,2 KB); e2e từ cổng vào thành phố rồi quay lại giữ nguyên lens, ngôn ngữ và chế độ.
- 33.3 Khung tĩnh: liên kết nhảy qua nội dung ở đầu trang, "Về dossier", danh sách khu phố dưới dạng liên kết thật (từ bản đồ nội dung), bản noscript và bản in. -> verify: e2e tắt JS liệt kê đủ mọi mục mở; bản in chỉ có dòng trỏ về dossier.
- 33.4 Khung bản Lite (lưới SVG tĩnh giữ chỗ cùng danh sách khu phố) để phương án dự phòng có từ ngày đầu. -> verify: ép bằng `?lite`, dùng được chỉ bằng bàn phím.
- 33.5 Nạp lười: gói thành phố chỉ nạp ở route thành phố; không có gì được nạp trước từ trang dossier. -> verify: log mạng ở trang dossier không có file city nào.
Checkpoint: chủ dự án bấm thử khung trống và phương án dự phòng.

## Hồi I — Xây thành phố

### P34 — Quy hoạch thành phố và tòa nhà sinh bằng code
- 34.1 Dữ liệu bố cục do người viết `src/city/plan.ts` (vị trí lưới của quảng trường, đại lộ, kênh, cầu, lô đất) cùng bộ sinh xác định cho hình khối tòa nhà từ tham số kiểu nhà (chân đế, độ cao, bậc lùi, bộ mái). Bố cục cố định, không ngẫu nhiên: câu chuyện của chủ dự án cần một thành phố ổn định. -> verify: test bất biến (không chân đế chồng nhau, đồ thị đường liền mạch, mọi lô đất đi tới được, mỗi mục trong bản đồ nội dung có đúng một lô, Hầm tồn tại).
- 34.2 Các kiểu nhà: sảnh học viện bậc thang, tháp ăng-ten / nhà máy chủ, sảnh chợ, tháp kính, gian thấp có cột cờ (trừu tượng, không cờ hay huy hiệu), đài quan sát, khối Hầm, các ki-ốt địa danh (Hộp thư chết, Phòng tổng kết, Tháp lưu trữ, Sổ rủi ro, Phòng thí nghiệm). Chọn theo `kind` và domain, không bao giờ theo bậc, số liệu hay trọng số lens. -> verify: ảnh chụp kiểu nhà cho từng mục; test cho thấy độ cao đường chân trời không tương quan với bậc bằng chứng.
- 34.3 Đổ bóng mặt từ một hướng sáng cố định, lưới cửa sổ, đồ trang trí mái, viền sáng cạnh; lớp tĩnh nướng một lần cho mỗi nấc zoom. -> verify: ghi lại thời gian nướng và bộ nhớ.
- 34.4 Trang dev `/dev/city-sheet` hiện mọi kiểu nhà cạnh nhau ở cả hai bảng màu. -> verify: ảnh chụp trong `docs/city/review/P34/`.
Checkpoint (gu thẩm mỹ): chủ dự án chọn giữa hai hướng đường chân trời nếu Claude Code làm hai hướng.

### P35 — Engine ban đêm (diện mạo Mật)
- 35.1 `city-tokens.css` dẫn xuất từ `tokens.css`; kiểm tra tương phản HUD nối vào `check:contrast`. -> verify: kết quả script.
- 35.2 Lớp bóng tối nửa độ phân giải với sprite ánh sáng đóng dấu (gradient nướng sẵn), vũng sáng đèn đường, viền sáng ở cạnh, ống đồng thau cho biển hiệu (sprite đóng dấu, không bộ lọc làm mờ), vài dải sương mỏng. -> verify: thời gian khung trong ngân sách; ảnh chụp.
- 35.3 Biển hiệu thanh che có rung (dùng lại hành vi thanh che của dossier và quy tắc giảm chuyển động của nó). -> verify: giảm chuyển động thì thanh che đứng yên.
- 35.4 Mưa tùy chọn (chỉ mức Cao), số hạt bị chặn. -> verify: đổi mức thì mưa mất và số hạt rơi xuống mức trần.
- 35.5 Nhiễu hạt tĩnh (không nhiễu vẽ lại mỗi khung). -> verify: không có cấp phát bộ nhớ mỗi khung trong vết.
Checkpoint: **khoảnh khắc đặc trưng 1 và 8** sẵn sàng chụp ảnh; chủ dự án duyệt diện mạo ban đêm.

### P36 — Agent T bản 1: biết đi, biết nhìn
- 36.1 Hình nhân dựng bằng code: thân, áo, mặt nạ, đèn thành các bộ đa giác, 8 hướng nhìn, chu kỳ đi 6 khung bằng phép biến đổi (kiểu dáng tạm cũng được, diện mạo cuối là P43). -> verify: trang dev xem bảng sprite.
- 36.2 Di chuyển: đi bằng bàn phím, bấm để đi bằng A* trên đồ thị đường, đích là cửa tòa nhà, va chạm với chân tòa nhà, phương án lùi khi bị kẹt. -> verify: unit test cho A*, va chạm và phương án lùi; e2e đi tới một cửa.
- 36.3 Chùm sáng của đèn bị chân tòa nhà che (đa giác nhìn thấy 2D, bắn tia với các cạnh chân tòa, lưu theo ô vị trí). -> verify: unit test trên một bố cục đã biết; thời gian khung khi bật chùm sáng.
- 36.4 Camera đi theo có làm mượt, giới hạn, ba mức zoom. -> verify: không giật ở biên zoom; giảm chuyển động thì bỏ làm mượt.
- 36.5 Bóng đổ dài từ hướng sáng cố định. -> verify: ảnh chụp.
Checkpoint: **khoảnh khắc đặc trưng 1** chạy được; chủ dự án tự đi dạo trong thành phố.

### P37 — Khu phố, nhiệm vụ, bản tóm tắt
- 37.1 Gợi ý khi lại gần và ở cửa; tương tác bằng `E`/`Enter`/bấm. -> verify: e2e.
- 37.2 Trạng thái khu niêm phong/đã dò/đã tóm tắt/đã giải mật, lưu trong `sessionStorage` bọc try/catch, chỉ là trang trí. -> verify: chạy được khi bị chặn lưu trữ; nội dung không bao giờ bị trạng thái chặn.
- 37.3 Hộp thoại bản tóm tắt (DOM, khóa focus, `Esc`), dùng lại component mục sổ cái (tách thành component dùng chung nếu cần, đừng sao chép markup). -> verify: test chữ của hộp thoại bằng chữ của sổ cái cho mọi mục, cả hai ngôn ngữ và cả hai chế độ.
- 37.4 HUD: bảng tên, nhật ký nhiệm vụ (vùng live), la bàn xếp theo trọng số lens đang chọn, "mức sáng n trên N" (không thanh phần trăm). -> verify: lens Đối tác, Khách hàng và Tò mò mỗi lens cho ra mục tiêu đầu tiên đúng như kỳ vọng.
- 37.5 Hầm (chỉ nhãn loại) và Hộp thư chết (nút yêu cầu có sẵn, không đổi, chỉ email trong allowlist). -> verify: e2e cho thấy không có địa chỉ nào khác; `check:leaks` sạch.
- 37.6 Mật danh và chữ tạo không khí soạn vào `docs/city/copy-review.md` (skill humanizer), các chuỗi nằm trong namespace `city` của `content/ui.json` (vi, en). -> verify: `check:locales` đạt; không chuỗi nào nêu sự thật không có trong nội dung.
Checkpoint: chủ dự án duyệt mật danh các khu và các câu tạo không khí.

### P38 — Engine ban ngày (diện mạo Giải mật)
- 38.1 Bảng màu bình minh và mặt trời thấp dịu, bóng ngắn mềm, biển hiệu rõ, phản chiếu kính bằng các stamp gradient nướng sẵn. -> verify: kiểm tra tương phản ở cả hai chế độ; ảnh chụp.
- 38.2 Nối chế độ với trạng thái chế độ hiện có (`mode.ts`) làm nguồn sự thật duy nhất; thành phố không bao giờ giữ chế độ riêng. -> verify: đổi trong thành phố thì dossier cập nhật, và ngược lại sau khi chuyển trang.
- 38.3 Trạng thái ánh sáng theo khu chạy ở cả hai chế độ. -> verify: ảnh chụp, 4 trạng thái × 2 chế độ cho một tòa nhà.
Checkpoint: chủ dự án so sánh đêm và bình minh cạnh nhau.

## Hồi II — Atlas

### P39 — Xuất dữ liệu Atlas (không dựng hình học mới)
- 39.1 Xuất lúc build từ đầu ra `buildMap` hiện có thành `atlas.json` (chuỗi path `d` của tỉnh theo từng chế độ, bậc, các nơi chốn từ `content/places.json`, các đảo của quần đảo và nhãn của chúng, sáu nhãn nước láng giềng, biên giới đất liền như bản đồ 2D). Không có nguồn hình học mới. -> verify: dung lượng ≤ 60 KB gzip, nếu không thì đơn giản hóa thêm lúc build với quy tắc diện tích tối thiểu **miễn cho các đảo Hoàng Sa và Trường Sa**.
- 39.2 Test chủ quyền: nhãn Hoàng Sa và Trường Sa trong dữ liệu atlas bằng đúng nhãn sinh ra cho bản đồ 2D ở vi và en, cả hai có "(Việt Nam)" như bản đồ 2D, và build lỗi nếu thiếu một nhãn. -> verify: thử bỏ một nhãn trong bản chạy nháp, thấy test lỗi, rồi khôi phục.
- 39.3 Không có đường nào trên biển trong dữ liệu xuất. -> verify: test trên các path đã xuất.
- 39.4 Riêng tư/hold: chỉ những nơi đã có trong `content/places.json`. -> verify: test.
Checkpoint: chủ dự án đọc dung lượng dữ liệu và kết quả test chủ quyền.

### P40 — Bàn Atlas
- 40.1 Vẽ các tỉnh bằng `Path2D(d)` và một phép nâng affine; các bậc theo độ cao của bản đồ 3D; biển lưới quét với đường quét chậm (tạm dừng khi ẩn). -> verify: ngân sách khung khi Atlas đang trên màn hình; ảnh chụp ở cả hai chế độ.
- 40.2 Các ghim từ places; Đà Nẵng là HQ; cột sáng thẳng đứng nhìn thấy trên cả thành phố. -> verify: cột sáng thấy được ở cả ba mức zoom trong sương.
- 40.3 Cụm đảo Hoàng Sa, Trường Sa và nhãn vẽ trong một lớp **bỏ qua sương mù, thanh che, mờ dần và ẩn khi zoom xa**. -> verify: kiểm tra điểm ảnh e2e tại các hình chữ nhật nhãn ở Mật có sương và ở zoom xa (nhãn vẫn còn); ảnh chụp.
- 40.4 Gợn khi rê/focus (180 ms lên, 160 ms xuống, chỉ transform, tức thì khi giảm chuyển động). -> verify: vết cho thấy không có layout.
Checkpoint: **khoảnh khắc đặc trưng 2 và 6**; chủ dự án duyệt Atlas, điểm "wow" lớn nhất của hồi này.

### P41 — Lao xuống bản đồ thật
- 41.1 Camera lao vào bàn, chuyển mờ sang DOM Map có sẵn trong một lớp phủ (zoom, kéo, chú giải, danh sách không đổi), `Esc` đưa về. -> verify: e2e; focus chuyển vào lớp phủ rồi quay lại.
- 41.2 Giảm chuyển động: đổi tức thì. Bản Lite: lớp phủ mở thẳng. -> verify: e2e cho cả hai.
- 41.3 Kiểm tra INP khi mở và đóng lớp phủ. -> verify: INP đo bằng web-vitals dưới 200 ms trên máy i3.
Checkpoint: **khoảnh khắc đặc trưng 7**.

### P42 — Atlas và các khu nói chuyện với nhau
- 42.1 Rê/focus vào một khu thì cột sáng Đà Nẵng sáng lên (như liên kết "⌖ Đà Nẵng" của dossier làm với dòng sổ cái); bản tóm tắt có nút "Xem trên Atlas". -> verify: e2e.
- 42.2 Nhật ký nhiệm vụ hiện nơi chốn của từng mục (hiện giờ đều ở Đà Nẵng) mà không viết cứng. -> verify: đổi một nơi chốn trong bản sao nháp của nội dung và thấy thành phố theo, rồi khôi phục.
Checkpoint: chủ dự án duyệt Hồi II từ đầu đến cuối.

## Hồi III — Agent T, nhân vật

### P43 — Nhân vật bản 2: dấu ấn riêng
- 43.1 Chiếc áo khoác dài với năm mảnh gấu trễ trên chuỗi lò xo; cổ áo bất đối xứng. -> verify: bảng sprite dev, 8 hướng × đi/nghỉ.
- 43.2 Mặt nạ (khe đồng thau theo hướng nhìn, tia sáng định kỳ) và Chiếc đèn (đung đưa, giơ lên ở cửa). -> verify: bảng ảnh chụp.
- 43.3 Cái bóng với gợi ý khi nghỉ quay về khu niêm phong gần nhất sau ~8 giây. -> verify: unit test chọn đúng lô niêm phong gần nhất; giảm chuyển động thì không quay.
- 43.4 Dải ruy băng (thanh che ở Mật, sợi vàng ở Giải mật), vòng thông hành (ký hiệu T1/T2/T3), hai kiểu nhàn rỗi và hai cử chỉ. -> verify: chi phí vẽ mỗi khung cho cả nhân vật ≤ 1,0 ms trên máy i3 ở mức Cao.
- 43.5 Ghi chú nguyên bản trong `docs/city/creative-log.md`: điều gì làm bóng dáng này nguyên bản và đã tránh những gì (xem UX-v4 mục 6, quy tắc 9). -> verify: ghi chú có đó.
Checkpoint (gu và an toàn): chủ dự án tìm ảnh theo bóng dáng và chọn giữa hai hướng thiết kế nếu có. **Khoảnh khắc đặc trưng 4 và 5 bắt đầu từ đây.**

### P44 — Chuỗi giải mật
- 44.1 Sóng bình minh từ Agent T, bảng màu đổi khi sóng đi qua, thanh che trượt đi, lớp lót áo lật lệch 60 ms, bảng tên đổi từ "Agent T" sang "Lê Thái Trung". -> verify: thời gian khung trong chuỗi, vết không có layout.
- 44.2 Thời lượng: ≤ 2,1 giây ở Cao, ≤ 1,2 giây ở Thấp, tức thì khi giảm chuyển động; bấm phím hay chuột bất kỳ để nhảy tới cuối; không bao giờ hai chuỗi cùng lúc. -> verify: e2e cho bỏ qua và kích hoạt hai lần.
- 44.3 Nhất quán trạng thái: sau chuỗi thì HUD, các bảng và chế độ dossier khớp nhau. -> verify: e2e.
Checkpoint: **khoảnh khắc đặc trưng 3 và 4 hoàn chỉnh**; chủ dự án quyết định chuỗi có quá dài không.

### P45 — Âm thanh tạo bằng code
- 45.1 Tổng hợp Web Audio cho bước chân, tiếng bật đèn, chuông cửa, tiếng quét giải mật, tiếng thành phố. Không file mẫu. Mặc định tắt, một công tắc. -> verify: `dist/` không có file âm thanh nào từ thành phố; test cho thấy âm thanh tắt lúc nạp.
- 45.2 Nối với cổng nhạc: nhạc nền chỉ xuất hiện nếu `check:audio` đạt (giấy phép). -> verify: không giấy phép thì không có bài và không có công tắc bài.
- 45.3 Âm thanh không bao giờ bắt đầu trước thao tác của người dùng; đóng context khi tab ẩn lâu. -> verify: thủ công và unit test với context giả.
Checkpoint: chủ dự án nghe thử có tai nghe và không tai nghe.

## Hồi IV — Sự sống và độ hoàn thiện

### P46 — Sự sống nền (có trần)
- 46.1 Vệt đèn xe trên đường (tối đa 6), hai đèn pha quét từ tháp, ăng-ten nhấp nháy, giấy/tro bay (có trần theo mức). Không người, không đám đông (không vẽ người thật). -> verify: test bộ đếm theo từng mức.
- 46.2 Mọi chuyển động nền tắt ở mức Thấp, đứng yên khi giảm chuyển động, giảm tốc khi nghỉ. -> verify: vết khi nghỉ ≤ ~20 fps.
Checkpoint: chủ dự án đánh giá thành phố có sống động mà không rối.

### P47 — Cảnh kết và phần thưởng
- 47.1 Khi mọi khu đã giải mật: thành phố trọn ánh sáng, cột sáng đứng yên, một bảng kết điềm đạm chỉ dựng từ nội dung ("Mở dossier đầy đủ", "In", "Yêu cầu giải mật"). Không điểm số, không pháo giấy. -> verify: e2e; chữ trong bảng chỉ từ nội dung.
- 47.2 Chỉ trứng phục sinh (easter egg) do chủ dự án duyệt (chủ dự án đưa danh sách; mặc định là không có). -> verify: danh sách trong nhật ký sáng tạo.
Checkpoint: **khoảnh khắc đặc trưng 9**.

## Hồi V — Gia cố

### P48 — Khả năng truy cập
- 48.1 Đường bàn phím đầy đủ tới mọi bản tóm tắt và địa danh; thứ tự focus; không bẫy; `Esc` thoát. -> verify: test Playwright chỉ dùng bàn phím đi qua mọi mục.
- 48.2 Vùng live: thông báo vị trí, nhật ký nhiệm vụ, không spam (giới hạn tần suất). -> verify: test tần suất thông báo.
- 48.3 Kiểm tra axe trên route thành phố ở cả hai chế độ và hai ngôn ngữ. -> verify: không vi phạm (dự án đã có `@axe-core/playwright`).
- 48.4 `prefers-reduced-motion`, `prefers-contrast`, zoom 200%, màu cưỡng bức: dùng được hoặc chuyển sang Lite. -> verify: chạy giả lập.
Checkpoint: chủ dự án thử chỉ bằng bàn phím.

### P49 — Di động và máy yếu
- 49.1 Điều khiển cảm ứng: chạm để đi, véo để zoom, nút "tương tác" nhìn thấy được, vùng an toàn, đổi hướng màn hình. -> verify: test giả lập di động của Playwright.
- 49.2 Hành vi trên thiết bị yếu: tự chọn Thấp hoặc Lite theo kiểm tra khả năng; cảnh báo bộ nhớ; `saveData`. -> verify: test ép khả năng.
- 49.3 Danh sách kiểm tra thủ công cho trình duyệt trong app (Zalo, Facebook, Messenger) ở `docs/city/manual-checks.md`; chủ dự án chạy trên điện thoại thật. -> verify: chủ dự án điền xong danh sách.
Checkpoint: chủ dự án thử trên điện thoại của mình và báo lại.

### P50 — Chiến dịch hiệu năng và bộ nhớ
- 50.1 `tools/perf/city-frames.spec.ts` (khung hình khi đi, zoom, mở Atlas, chạy Giải mật) ở tốc độ thường và giảm CPU 4×. -> verify: số p95 so với ngân sách, có ghi lại.
- 50.2 Thử bền mười phút: đi, nghỉ, đổi chế độ, mở Atlas, lặp lại. Lấy mẫu heap và số listener. -> verify: mức tăng nằm trong ngân sách.
- 50.3 Quan sát long-animation-frame và long-task trong lần thử bền. -> verify: không tác vụ nào > 50 ms ngoài chuỗi giải mật.
- 50.4 Áp dụng danh sách cắt ở mục 14 của UX-v4 cho mọi thứ vượt ngân sách. -> verify: đo lại sau mỗi lần cắt và ghi lại.
Checkpoint: chủ dự án xem bảng số liệu cuối cùng.

### P51 — Kiểm toán riêng tư, nội dung và rò rỉ
- 51.1 Mở rộng `check:leaks` ra toàn bộ route thành phố và JSON của nó. Chuỗi bị cấm (vai trò trợ lý và mọi thứ liên quan, logo tổ chức thật, nơi chốn chưa duyệt, chính trị ngoài các nhãn bản đồ đã duyệt). -> verify: ca lỗi cố ý được bắt.
- 51.2 Kiểm toán mạng: Playwright chặn mọi yêu cầu bên ngoài suốt một lượt chạy đầy đủ mà thành phố vẫn chạy; không đặt cookie. -> verify: test.
- 51.3 Đồng nhất nội dung: với mỗi mục, vi và en, Mật và Giải mật, bản tóm tắt bằng sổ cái. -> verify: ma trận test.
- 51.4 Hồi quy chủ quyền: nhãn có mặt ở mọi tổ hợp chế độ, ngôn ngữ, bậc, zoom và bản Lite. -> verify: ma trận test.
- 51.5 Ghi công và giấy phép: `docs/city/credits.md` (dự kiến không có gì vì không nhập gì từ bên ngoài). -> verify: file ghi "không có tài nguyên bên thứ ba".
Checkpoint: chủ dự án đọc bản kiểm toán.

### P52 — Bộ duyệt và chuẩn bị phát hành
- 52.1 Script chụp xuất bộ ảnh cho chủ dự án duyệt (cả hai chế độ, ba mức zoom, Atlas, bốn trạng thái, bảng sprite, chuỗi giải mật dưới dạng dải khung ngắn) vào `docs/city/review/final/`. -> verify: ảnh mở được.
- 52.2 Duyệt chữ: `docs/city/copy-review.md` đầy đủ; mọi chuỗi chủ dự án đã duyệt đều được đánh dấu. -> verify: không chuỗi chưa duyệt nào nằm trong bản build (test).
- 52.3 Công tắc phát hành: thành phố vẫn nằm sau `PUBLIC_CITY`. Ghi đúng các bước để bật nó, và cách phát hành dossier mà không có nó (để phát hành P30 của v3 không bao giờ bị chặn). -> verify: `build:prod` không có cờ thì không có city; có cờ thì có và qua mọi kiểm tra.
- 52.4 Cập nhật các con trỏ trong `SPEC.md`, `CLAUDE.md` và `README`. Không commit, push hay deploy. -> verify: tóm tắt diff gửi chủ dự án.
Checkpoint: chủ dự án quyết định thành phố có nằm trong bản phát hành công khai đầu tiên hay ra sau.

## Hạng mục phụ (tắt mặc định; mỗi cái bị gỡ nếu tốn quá 2 ms mỗi khung trên máy i3)
- S1 **Chế độ hành động**: một lớp ẩn nấp nhẹ nơi đèn pha quét làm đèn của ông mờ đi trong chốc lát; bị "thấy" không có hình phạt nào ngoài việc đèn chập chờn. Bỏ qua được, không bao giờ bắt buộc.
- S2 **Giờ trong ngày**: một chu kỳ chạng vạng đến bình minh chậm trong thành phố, tách riêng khỏi Mật/Giải mật (chỉ để trang trí).
- S3 **Chế độ chụp ảnh**: ẩn HUD và lưu một ảnh PNG của khung nhìn hiện tại cho chủ dự án dùng riêng; không EXIF, không dữ liệu.
- S4 **Thành phố yên tĩnh**: một chế độ lặng với thời tiết, xe cộ và đèn pha tắt, cho những ai chỉ muốn xem bản đồ.

## Việc chủ dự án cung cấp
- Duyệt mật danh và chữ tạo không khí (P37, P52).
- Chọn giữa các phương án ở các checkpoint gu thẩm mỹ (P34, P43).
- Tìm ảnh theo bóng dáng nhân vật (P43).
- Thử trên điện thoại thật và trình duyệt trong app (P49).
- Quyết định khi nào thành phố được phát hành (P52).
