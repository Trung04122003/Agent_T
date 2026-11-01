# Đánh giá màn hình cổng (P25)

Ngoại lệ do chủ dự án duyệt ngày 28/10/2026 (DECISIONS-v3.md): riêng P25 được đo cổng, dù SPEC cấm analytics. Chủ dự án chọn **đo cục bộ trước**. Sự kiện chỉ nằm trong trình duyệt, không gửi đi đâu. Nhà cung cấp để đo người xem thật được chọn lúc phát hành (P30).

UX-v3 mục 2 đặt câu hỏi cần trả lời: cổng thêm một cú bấm, vậy người xem có bỏ đi nhiều hơn không? Câu trả lời đó chỉ có được từ người xem thật. Tài liệu này gồm ba phần: những gì đo được ngay trong phòng thử, cách cổng tự ghi sự kiện, và kế hoạch đo trên người xem thật kèm ngưỡng đề xuất để quyết định giữ hay bỏ cổng.

## 1. Đo trong phòng thử

Công cụ: `node tools/gate-eval.mjs [--build]`, chạy trên bản `build:prod` + preview, Chromium của Playwright. Mỗi hồ sơ chạy 3 lần, lấy trung vị; kết quả ghi vào `.perf/gate-eval.json`. Mốc thời gian tính từ lúc bắt đầu tải trang.

| Hồ sơ | "Bỏ qua" bấm được | Nút lens vào xong | Dòng của lens gõ xong | Số thao tác để vào | Từ thao tác tới trang chính |
|---|---|---|---|---|---|
| Máy bàn, chuột (1280×800) | 348 ms | 1 002 ms | 1 505 ms | 1 | 81 ms |
| Máy bàn, bàn phím (Enter ở nút đang có tiêu điểm) | 295 ms | 1 025 ms | 1 530 ms | 1 | 48 ms |
| Điện thoại, chạm (Pixel 5, CPU chậm 4×) | 1 027 ms | 1 492 ms | 1 993 ms | 1 | 220 ms |

Đọc kết quả:
- Cổng không bắt chờ. Mọi nút bấm được ngay khi trang vừa hiện ra: "Bỏ qua" hiện ngay lần vẽ đầu, các nút lens bấm được trong lúc chúng còn đang trượt vào. Không có hẹn giờ nào giữ người xem lại.
- Một thao tác là vào, ở cả ba cách dùng. Sau thao tác đó, trang chính và tiêu điểm ở `<h1>` có ngay, trong 50–220 ms.
- Phần trình diễn (giải mã chữ, các nút trượt vào, dòng của lens gõ ra) kéo dài khoảng 1,5 s trên máy bàn và 2 s trên điện thoại chậm. Người xem không phải xem hết mới được vào.
- Không quá 2 hiệu ứng chạy cùng lúc, kể cả khi đổi ngôn ngữ (`e2e/entry.e2e.ts`). Không thêm yêu cầu mạng. JS của cổng là 3 078 B gzip (kể cả màn chờ sau khi chọn lens), giới hạn là 3,2 KB (nới từ 3 KB ngày 01/11/2026).

## 2. Đối chiếu với yêu cầu thiết kế

| Yêu cầu (UX-v3, chủ dự án) | Hiện trạng |
|---|---|
| Màn cổng không giả vờ tải: không số %, không chữ "loading". Sau khi chọn lens có màn chờ đặc nhiệm 1,68 giây (chủ dự án chọn 01/11/2026, thay 25.2), bỏ qua được | Đạt, có test |
| Bỏ qua được bằng một thao tác, "Bỏ qua" hiện từ giây 0 | Đạt. Nếu script lỗi, "Bỏ qua" vẫn là liên kết thật (`?skip=1`) nên người xem không bị kẹt. Từ 01/11/2026 "Bỏ qua"/Esc chạy màn chờ rồi vào hồ sơ không có lens (dòng định vị chung); `enter` ghi `lens: null` |
| Hiện ở mọi lần tải trang, kể cả tải lại (chủ dự án đổi 01/11/2026, thay cho "tối đa một lần mỗi phiên"); không hiện với liên kết sâu, `?skip`, khi in, khi tắt JS | Đạt, mỗi trường hợp có test |
| Trợ năng: dialog, `inert`, tiêu điểm vào và trả về `<h1>` | Đạt, axe không báo lỗi |
| Chủ dự án: đập vào mắt nhưng không rối | Đạt: một nhịp mở (dải, mật danh giải mã, câu hỏi, ba lens), một vòng ngắm tĩnh làm nền, và dòng của phân khúc chỉ hiện khi người xem trỏ vào |
| Chủ dự án: giải mã toàn màn hình khi đổi ngôn ngữ | Đạt: mọi nhãn ngắn và mật danh giải mã lại, ba nút lens trượt vào lại (dải và câu hỏi không quét lại, để không thành hiệu ứng thứ ba bên cạnh hiệu ứng khoá mục tiêu của con trỏ trên lá cờ), dòng đang xem gõ lại bằng ngôn ngữ mới |

Rủi ro còn lại:
- Trên điện thoại không có thao tác trỏ chuột, nên người xem chỉ thấy dòng của "Đối tác" (nút có tiêu điểm sẵn). Dòng của hai phân khúc kia chỉ hiện sau khi đã vào trang.
- Cổng che phần đầu trang, nơi có ảnh và dòng định vị, ở lần xem đầu của phiên. Đây đúng là cái giá UX-v3 đã nói tới. Chỉ dữ liệu thật mới cho biết cái giá đó lớn hay nhỏ.

## 3. Cổng tự ghi những gì

File `src/scripts/gate-metrics.ts` giữ 200 sự kiện gần nhất trong `localStorage["gateMetrics"]`, đồng thời phát sự kiện `cupid:gate` trên `window`. Không có dữ liệu nào nhận diện người xem.

| Sự kiện | Khi nào | Dữ liệu |
|---|---|---|
| `shown` | Cổng hiện ra | ngôn ngữ |
| `preview` | Lần đầu người xem thấy dòng của một lens | lens |
| `lang` | Đổi ngôn ngữ ngay trong cổng | ngôn ngữ mới |
| `enter` | Vào trang | cách vào (`lens`, `skip`, `esc`), lens, số ms từ lúc hiện cổng |
| `leave` | Đóng hoặc rời trang khi cổng còn mở | số ms từ lúc hiện cổng |

Xem nhật ký trên máy của mình: mở DevTools, vào Console, gõ `JSON.parse(localStorage.gateMetrics)`.

## 4. Đo trên người xem thật (P30, khi đã chọn nhà cung cấp)

Chỉ số và ngưỡng dưới đây là **đề xuất**, chủ dự án chốt:

| Chỉ số | Cách tính | Ngưỡng đề xuất |
|---|---|---|
| Tỉ lệ bỏ đi ở cổng | `leave` / `shown` | Bỏ cổng nếu > 15% sau ít nhất 100 lượt `shown` |
| Thời gian quyết định | trung vị `ms` của `enter` | Xem lại thiết kế nếu > 8 s |
| Tỉ lệ "Bỏ qua" + Esc | (`skip` + `esc`) / `enter` | Nếu > 60%, câu hỏi chưa đủ hấp dẫn: sửa câu chữ trước khi bỏ cổng |
| Phân bố lens | số `enter` theo từng lens | Để chủ dự án biết ai đang đọc hồ sơ |
| Tỉ lệ xem dòng | lens có `preview` / `shown` | Cho biết dòng của từng phân khúc có được đọc hay không |

Muốn so sánh công bằng thì cần nhóm đối chứng. Ví dụ: một phần người xem vào thẳng không qua cổng (như `?skip=1`), rồi so tỉ lệ ở lại trên trang của hai nhóm. Việc này cần nhà cung cấp hỗ trợ chia nhóm, nên để P30 quyết.
