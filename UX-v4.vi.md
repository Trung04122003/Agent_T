# UX v4 — Thành phố Agent T (2.5D)

> Bản tiếng Việt để chủ dự án đọc. **Bản gốc cho Claude Code là `UX-v4.md` (tiếng Anh); nếu hai bản lệch nhau thì theo bản tiếng Anh.**

Đi kèm `ROADMAP-v4.md`. Chỗ nào ghi "phải" là quy tắc. Chỗ nào ghi "gợi ý" thì Claude Code được làm tốt hơn nếu đo ra tốt hơn (ghi vào `docs/city/creative-log.md`).

## 0. Ý tưởng trong một đoạn
Một thành phố ban đêm mà ông khám phá với tư cách Agent T. Bóng tối là phần còn bị niêm phong; ánh sáng là phần đã giải mật. Mỗi mục hồ sơ là một tòa nhà. Đi tới đó, mở bản tóm tắt và giải mật thì đèn của nó bật lên. Giữa thành phố là Atlas: bàn bản đồ nổi của Việt Nam, có một cột sáng trên Đà Nẵng nhìn thấy từ mọi nơi. Chuyển từ Mật sang Giải mật là một buổi bình minh quét qua cả thành phố. Thành phố là một lối khác vào **cùng những sự thật đó**: nó không thêm điều khẳng định nào, không giấu điều nào sau một trò chơi, và dossier thường chỉ cách một phím bấm.

Nguyên tắc: (1) dossier là sự thật, thành phố chỉ là một thấu kính; (2) ít thứ, làm có chủ đích; (3) mọi thứ sinh từ code và dùng cùng token với dossier; (4) rẻ ngay từ thiết kế (máy i3 là mốc sàn); (5) site vẫn phải chạy khi tắt JS, khi chỉ dùng bàn phím, và khi in.

## 1. Luồng đi
Lối vào (đều là liên kết thường, không thêm JS cho trang dossier):
- Cổng: một liên kết phụ nhỏ dưới phần chọn lens, "Vào thành phố Agent T".
- Đầu trang dossier: cùng liên kết đó. Mang theo `?lens=` và ngôn ngữ; chế độ theo chế độ đã lưu.
Lối ra: nút "Về dossier" luôn hiện trong HUD, `Esc` mở lời nhắc thoát (một lần bấm, không cần hộp xác nhận nếu chưa nhập gì), nút Back của trình duyệt hoạt động, liên kết nhảy qua nội dung nằm ở đầu trang và truy cập được bằng `Tab`.
Không JS: trang hiện danh sách khu phố dưới dạng liên kết thật tới các bản tóm tắt (HTML tĩnh). In: một dòng trỏ về dossier, và bản in của dossier.
Route là `noindex`, canonical trỏ về dossier.
Liên kết sâu: `/city/#d-<claim-id>` mở thẳng bản tóm tắt đó (cũng là liên kết của danh sách khu phố trong DOM).

## 2. Quy hoạch thành phố
Bố cục gợi ý (Claude Code được tinh chỉnh, giữ nguyên logic):
```
                B
      [Phòng tín hiệu]    [Tháp lưu trữ]
   [Học viện]   \  đại lộ  /   [Xưởng]
        \        \        /       /
  tây ===  [  QUẢNG TRƯỜNG ATLAS  ]  === đông
        /        /        \       \
   [Chợ lớn]  /   đại lộ   \   [Tháp kính]
      [Đài quan sát]       [Phố đối ngoại]
                N       [ Hầm ] (khối đen niêm phong)
```
- **Mỗi mục hồ sơ mở có một lô đất**, sinh từ nội dung đã lọc (7 mục mở tính đến 02/11/2026), cộng một **Hầm** cho `classified` (khối đen niêm phong, chỉ nhãn loại, không có chữ).
- Kiểu tòa nhà chọn theo `kind` và `domain` (từ `content/domains.json`), không bao giờ theo con người: giáo dục = sảnh học viện bậc thang; công nghệ = tháp ăng-ten hoặc nhà máy chủ; kinh doanh = sảnh chợ; tài chính – bảo hiểm = tháp kính (không logo, chỉ chữ tên tổ chức trên biển); ngoại giao = gian thấp có cột cờ trơn (trừu tượng, **không biểu tượng quốc gia, không cờ, không huy hiệu**); dự án = đài quan sát hoặc cột cảm biến.
- Các địa danh cho thành phần dossier có sẵn: Tháp lưu trữ (sổ cái), Phòng tổng kết (AAR), Sổ rủi ro (risks), Phòng thí nghiệm (ma trận năng lực và chuỗi truy nguồn), **Hộp thư chết** (liên hệ: một ki-ốt buồng điện thoại/hộp thư mở nút "Yêu cầu giải mật", thứ duy nhất chạm tới email). Địa danh chỉ xuất hiện nếu nội dung của nó có và không `null`.
- Một con sông hay kênh và vài cây cầu được phép để đường chân trời đa dạng. Không khẳng định bờ biển nào trong thành phố (Atlas mới có bờ biển thật).
- Quy tắc đường chân trời: tòa cao nhất không phải mục "quan trọng nhất". Độ cao đến từ kiểu tòa nhà, không bao giờ từ bậc bằng chứng, số liệu hay trọng số lens.

## 3. Phép chiếu, camera, điều khiển
- Isometric 2:1. Một mô-đun chiếu cho cả thành phố. Atlas dùng lại các chuỗi hình học của bản đồ 2D/3D; lớp phủ DOM Map giữ `TILT` riêng của nó.
- Camera đi theo Agent T có làm mượt; giới hạn di chuyển ở rìa thành phố; 3 mức zoom (xa, vừa, gần), `+`/`-` và lăn chuột, véo hai ngón trên cảm ứng. Zoom chỉ vẽ lại khi thao tác dừng.
- Bàn phím: mũi tên hoặc WASD để đi; `Shift` đi nhanh hơn; `E` hoặc `Enter` để tương tác (mở bản tóm tắt, dùng Hộp thư chết); `M` đổi Mật/Giải mật; `F` bay camera tới mục tiêu kế tiếp (lướt, không dịch chuyển tức thì); `H` hiện hướng dẫn phím; `Esc` thoát bảng, rồi thoát thành phố. Mọi hành động đều có đường bàn phím.
- Chuột: bấm hoặc chạm một điểm để đi tới đó (A* trên đồ thị đường); bấm vào tòa nhà để đi tới cửa và mở. Con trỏ: dùng lại con trỏ dossier theo chế độ trên máy tính; không con trỏ riêng trên cảm ứng.
- Va chạm với chân tòa nhà; người chơi không bao giờ bị kẹt (có phương án lùi về ô trống gần nhất).
- Giảm chuyển động: không làm mượt camera, không thời tiết, không chuyển động nền, đi bộ thành từng bước hoặc nhảy tức thì giữa các điểm quan tâm.

## 4. Hệ thống ánh sáng và bóng tối
Trạng thái của mỗi khu (chỉ là trang trí, lưu trong `sessionStorage`, không bao giờ chặn nội dung):
| Trạng thái | Diện mạo (Mật / ban đêm) | Ý nghĩa |
|---|---|---|
| niêm phong | Khối tối, biển có thanh che | chưa ghé |
| đã dò | Viền sáng, biển đọc được một phần | thấy từ trong tầm sáng |
| đã tóm tắt | Cửa sổ sáng, chữ tóm lược đọc được | đã mở bản tóm tắt |
| đã giải mật | Sáng hẳn, thanh che trượt đi, thấy tóm tắt và phần xem trước bằng chứng | đã mở bản tóm tắt bằng Giải mật |
Bộ đếm tiến trình "mức sáng n trên N" ở HUD, không bao giờ thanh phần trăm, không bao giờ điểm số.
- **Sương mù chiến tranh:** một lớp bóng tối nửa độ phân giải; đèn của Agent T cắt một hình quạt (bị chân tòa nhà che) và một vòng sáng nhỏ quanh người; đèn đường để lại vũng sáng; khu đã sáng giữ nguyên sáng. Ánh sáng theo con trỏ chỉ có trên máy tính.
- **Cột sáng:** một cột sáng thẳng đứng ở Atlas trên Đà Nẵng, thấy được từ cả thành phố, đập chậm. Đây là la bàn cuối cùng.
- **Bóng đổ:** bóng dài từ một hướng sáng cố định ở Mật; ngắn và mềm ở Giải mật.
- Không dùng `backdrop-filter`, `filter` của canvas, bóng mờ lớn hay gradient lớn vẽ lại mỗi khung. Nướng sẵn gradient thành sprite nhỏ rồi đóng dấu.
- Bảng màu: đọc `src/styles/tokens.css`; token của thành phố nằm ở `src/styles/city-tokens.css` và dẫn xuất từ token hiện có. Không thêm họ màu mới nếu chưa hỏi. Mật = đen mực + đồng thau; Giải mật = ánh sáng ấm + vàng tài chính. Chữ HUD phải qua `check:contrast` ở cả hai chế độ.

## 5. Atlas
- Một bàn hình nổi ở quảng trường trung tâm: các tỉnh được nâng lên theo đúng các bậc ruộng bậc thang của bản đồ 3D (`home`, `near`, `base`), vẽ từ các chuỗi path `d` có từ lúc build bằng `Path2D` và một phép nâng affine; biển là lưới quét mờ có một đường quét chậm (tạm dừng khi tab ẩn).
- Các ghim chỉ lấy từ `content/places.json`. Đà Nẵng được đánh dấu là HQ và có cột sáng.
- **Hoàng Sa và Trường Sa**: vẽ thành cụm đảo ở đúng vị trí thật, ghi "(Việt Nam)" qua cùng nguồn nhãn với bản đồ 2D. Chúng được miễn khỏi sương mù, thanh che, mờ dần, ẩn khi zoom xa và đơn giản hóa hình. Không có đường nét đứt hay liền nào trên biển. Biên giới đất liền và sáu nhãn nước láng giềng theo đúng bản đồ 2D hiện có.
- Rê chuột hoặc focus vào ghim hay tỉnh thì nó nhô lên một bậc (cùng hiệu ứng 180/160 ms của bản đồ 3D, chỉ `transform`).
- **Lao xuống:** đứng ở Atlas bấm `E`: camera lao vào bàn, rồi chuyển mờ sang DOM Map có sẵn và truy cập được (zoom, kéo, chú giải, danh sách) trong một lớp phủ. `Esc` đưa camera về. Giảm chuyển động: đổi tức thì.
- Trước/sau sáp nhập tỉnh 2025: theo đúng cách `Map.astro` làm ở từng chế độ. Đừng tự nghĩ ra quy tắc mới.

## 6. Agent T: cuốn "kinh thánh" nhân vật
Mục tiêu: độc lạ, nhớ lâu, nhìn là biết đặc vụ, và nguyên bản 100%. Dựng bằng code từ các đa giác (không sprite, không ảnh), 8 hướng, vẫn đọc được ở chiều cao 48 px.
1. **Chiếc áo khoác dài.** Áo khoác dài màu tối. Gấu áo tách thành năm mảnh đuôi trễ theo chuyển động bằng chuỗi lò xo, như những trang hồ sơ bị xé. Cổ áo bất đối xứng: bên trái cao và cứng như tab tệp hồ sơ, bên phải thấp.
2. **Mặt nạ.** Đầu nhẵn, mờ, không mặt, chỉ có một khe ngang mảnh màu đồng thau. Khe dịch về hướng đang nhìn (cũng là dấu hiệu hướng). Cứ vài giây lại có một tia sáng quét qua. Không mặt, không ảnh, không giống người thật: chiếc mặt nạ chính là nhân vật.
3. **Chiếc đèn.** Một hình trụ đồng nhỏ cầm trong tay, tạo ra chùm sáng. Nó đung đưa theo nhịp bước và được giơ lên khi tới cửa.
4. **Cái bóng.** Bóng đổ là một bản sao nghiêng của hình bóng nhân vật. Sau khoảng 8 giây đứng yên, bóng quay đầu từ từ về phía khu bị niêm phong gần nhất (một gợi ý lặng lẽ, và là một khoảnh khắc đặc trưng). Ngoài ra bóng không có gì siêu nhiên.
5. **Dải ruy băng.** Phía sau nhân vật là một dải mảnh: ở Mật là các thanh đen (lối đi bị che dần phía sau, mặt đất sau lưng tối lại); ở Giải mật là một sợi vàng mảnh. Nó mờ đi sau vài giây. Chỉ để trang trí: không có trục, không có giá trị, không đọc ra xu hướng đi lên.
6. **Vòng thông hành** dưới chân: một hình elip mảnh có kiểu nét đứt cho biết mức thông hành của khu đang đứng (ký hiệu T1, T2, T3, từ bậc bằng chứng đã tính).
7. **Nhàn rỗi và cử chỉ** (hai kiểu nhàn rỗi, hai cử chỉ, không hơn): xem cổ tay (vòng đồng nhấp nháy); chạm cổ áo; giơ đèn ở cửa; chạm tai nghe ở Hộp thư chết.
8. **Biến hình khi giải mật:** năm mảnh gấu áo lật như trang giấy, lần lượt từ cổ xuống gấu (cách nhau khoảng 60 ms), để lộ **lớp lót vàng**; khe mặt nạ mở thành một vòng thấu kính với tia sáng ấm; đèn đổi từ trắng lạnh sang vàng ấm; bảng tên đổi từ "Agent T" sang "Lê Thái Trung" (đúng hai nhãn như khung ảnh chân dung). Ở cả hai chế độ nhân vật vẫn đeo mặt nạ.
9. **Quy tắc nguyên bản.** Tránh các diện mạo gắn với nhân vật có sẵn: vest tối với kính đen và sơ mi trắng; mũ phớt và áo choàng đỏ; mã vạch trên đầu trọc; sát thủ trùm mũ. Viết một ghi chú ngắn về tính nguyên bản trong `docs/city/creative-log.md`. Chủ dự án sẽ tìm ảnh theo bóng dáng nhân vật ở checkpoint P43; đổi thiết kế nếu có gì trùng.
10. Không vũ khí, không đồng phục, không huy hiệu, không trang phục quân đội. Nhân vật là người quan sát mang theo một ngọn đèn.

## 7. HUD và các bảng
- HUD (DOM, không phải canvas, để truy cập được): góc trên trái là bảng tên "AGENT T" và chế độ; góc trên phải là công tắc chế độ, công tắc âm thanh, chất lượng, trợ giúp phím, "Về dossier"; góc dưới trái là nhật ký nhiệm vụ (một dòng mỗi hồ sơ, kèm biểu tượng trạng thái); góc dưới phải là la bàn với mục tiêu kế tiếp xếp theo trọng số **lens** trong `content/lenses.json` (người xem Đối tác thấy lộ trình Đối tác trước). La bàn chỉ là gợi ý, không phải cổng chặn.
- Bảng tóm tắt (hộp thoại DOM, khóa focus, `Esc` đóng): hiện đúng những gì sổ cái hiện cho mục đó (dùng lại component, đừng sao chép markup): bản tóm lược ở Mật, bản tóm tắt ở Giải mật, các dòng bằng chứng kèm bậc. Một nút "Mở trong dossier" dẫn tới neo `#claim-<id>` của sổ cái.
- Bảng Hầm: chỉ nhãn loại. Bảng Hộp thư chết: nút "Yêu cầu giải mật" có sẵn, không đổi.
- Nhật ký nhiệm vụ và các bảng là vùng live (`aria-live="polite"`) và dùng được hoàn toàn khi không có canvas.

## 8. So sánh Mật và Giải mật
| | Mật (ban đêm) | Giải mật (bình minh) |
|---|---|---|
| Ánh sáng | chùm đèn, đèn đường, viền sáng | mặt trời, ánh vàng dài mềm |
| Biển hiệu | thanh che, rung nhẹ | chữ rõ, thanh che đã trượt đi |
| Bầu trời | đen, sương mỏng, mưa tùy chọn ở mức Cao | gradient nhạt, sương mỏng |
| Atlas | lưới quét mờ, bậc đồng thau | hình nổi sáng, bậc vàng |
| Nhân vật | áo đen, mặt nạ đồng thau, đèn trắng lạnh | lớp lót vàng, vòng thấu kính, đèn vàng ấm |
| Ruy băng | thanh che đen | sợi vàng mảnh |
| Âm thanh | tiếng ù thấp, bị bóp nghẹt | thoáng hơn, sáng hơn (cùng bộ tổng hợp, bộ lọc mở ra) |

## 9. Chuỗi giải mật (khoảnh khắc đỉnh, bỏ qua được)
Mốc thời gian (ms, gợi ý): 0 nín thở (âm nền dịu xuống) · 0–300 đèn bùng lên · 300–1700 sóng bình minh lan từ Agent T ra cả thành phố như một đợt quét clip/ghép lớp, các tòa nhà đổi bảng màu khi sóng đi qua, thanh che trượt khỏi biển hiệu · 400–900 lớp lót áo lật · 1700–2100 lắng xuống, đổi bảng tên · tổng ≤ 2,1 giây ở mức Cao, ≤ 1,2 giây ở mức Thấp, tức thì khi giảm chuyển động. Bấm phím hay chuột bất kỳ để nhảy tới trạng thái cuối. Không bao giờ chạy hai chuyển cảnh như vậy cùng lúc. Chỉ dùng `transform`, `opacity` và ghép lớp canvas; không đụng bố cục.

## 10. Âm thanh
Chỉ dùng Web Audio tạo bằng code (không file mẫu): bước chân (tiếng tách nhẹ), tiếng bật đèn, chuông cửa, tiếng quét giải mật, tiếng thành phố xa. Mặc định tắt, một công tắc, âm lượng thấp; `prefers-reduced-motion` không đổi âm thanh nhưng công tắc luôn với tới được. Bản nhạc nền vẫn nằm dưới cổng nhạc có sẵn (`check:audio`, cần giấy phép).

## 11. Những khoảnh khắc đặc trưng (ít nhất một mỗi phase)
1. Ngọn đèn cắt một hình quạt xuyên bóng tối, bị các tòa nhà che.
2. Cột sáng trên Đà Nẵng nhô lên khỏi sương mù.
3. Biển hiệu hết bị che khi sóng bình minh đi qua.
4. Lớp lót áo lật sang màu vàng.
5. Cái bóng quay lại nhìn tòa nhà niêm phong kế tiếp.
6. Các bậc Atlas nhô lên dưới con trỏ.
7. Cú lao từ quảng trường xuống bản đồ thật.
8. Mưa trên tháp kính (chỉ mức Cao).
9. Mọi khu đều sáng: thành phố trọn ánh sáng, cột sáng đứng yên.
10. Hộp thư chết: nơi duy nhất thế giới này chạm tới hộp thư thật.

## 12. Khả năng truy cập và phương án dự phòng
- Toàn bộ nội dung với tới được mà không cần canvas: danh sách khu phố tĩnh (liên kết), danh sách địa danh, cùng các bảng.
- Canvas là `aria-hidden`; một vùng live ẩn thị giác thông báo vị trí ("Gần Học viện, có bản tóm tắt").
- Focus nhìn thấy được, thứ tự hợp lý, không bẫy bàn phím, `Esc` luôn thoát được.
- Tương phản: HUD và các bảng đạt WCAG AA ở cả hai chế độ. Không chỉ dựa vào màu (các trạng thái có biểu tượng và chữ).
- Giảm chuyển động, `prefers-contrast`, zoom 200% và chế độ tương phản cao phải cho ra một thành phố dùng được, hoặc chuyển sang bản Lite.
- **Bản Lite** (không có thế giới canvas): một bản đồ thành phố SVG tĩnh dựng sẵn, bấm được từng khu, cùng các bảng. Dùng khi kiểm tra khả năng thất bại, khi RAM rất thấp, khi `saveData`, hoặc khi người dùng chọn.

## 13. Các mức chất lượng
| Mức | Tính năng | Mục tiêu |
|---|---|---|
| Cao | mưa, sương mù nửa độ phân giải, tối đa ~120 hạt, phản chiếu giả | laptop hiện đại |
| Vừa | không mưa, ~40 hạt, sương mù nửa độ phân giải | máy i3 chuẩn phải giữ được mức này |
| Thấp | chỉ nền nướng sẵn, tắt chuyển động nền, sương mù 0,35, giới hạn 30 fps | điện thoại yếu |
| Lite | không có thế giới canvas | dự phòng |
Tự hạ mức theo trung bình trượt của khung hình (không bao giờ tự nâng lại trong cùng phiên); có nút "Chất lượng" thủ công ở HUD. Dừng mọi thứ khi `document.hidden`; hạ chuyển động nền xuống ~20 fps sau 20 giây không thao tác.

## 14. Danh sách cắt và tiêu chí loại bỏ
Nếu một tính năng vượt ngân sách sau khi đã tối ưu hợp lý, nó bị cắt theo thứ tự: mưa, phản chiếu, xe cộ nền, đèn pha quét, độ mượt của sương mù, cử chỉ nhàn rỗi, các mức zoom camera. Không bao giờ hạ ngân sách. Các hạng mục phụ (chế độ ẩn nấp, giờ trong ngày, chế độ chụp ảnh) tắt mặc định và bị gỡ nếu tốn quá 2 ms mỗi khung trên máy i3.

## 15. Nghiệm thu (bằng mắt chủ dự án)
1. Trong năm giây một người lạ nói "thành phố đặc vụ" mà không cần ai bảo.
2. Chỉ nhìn bóng dáng đã nhận ra Agent T, và nó không giống nhân vật nào khác.
3. Giải mật khiến người ta "ồ" một tiếng nhỏ, một lần, và bỏ qua được.
4. Atlas hiện đúng Việt Nam thật với Hoàng Sa và Trường Sa ghi "(Việt Nam)" ở mọi trạng thái.
5. Mọi mục hồ sơ với tới được chỉ bằng bàn phím, và mọi bảng khớp với chữ của sổ cái.
6. Máy i3 giữ được mức Vừa với p95 thời gian khung dưới 20 ms.
7. Tắt JS hoặc chọn Lite vẫn kể được cả câu chuyện.

## 16. Quy tắc chữ
Ngắn, cụ thể, trầm. Không dấu chấm than, không tiếng lóng game, không thanh phần trăm, không "hoàn thành nhiệm vụ" hay điểm số. Câu tạo không khí được gợi tâm trạng ("Đèn khu này vẫn chưa bật") nhưng không được nêu điều gì mà nội dung không nêu. Mọi chuỗi mới nằm trong namespace `city` của `content/ui.json` cho cả vi và en, liệt kê trong `docs/city/copy-review.md`.
