# Font và hồ sơ chữ (P27)

Bốn hồ sơ chữ cố định, chọn trong bảng "Aa" cạnh công tắc chế độ. Người xem không được chọn font tự do (UX-v3 mục 4). Hồ sơ chữ chỉ đổi thân bài và tiêu đề; nhãn mono, dải phân loại và số liệu giữ nguyên.

| Hồ sơ | Mã (`data-font`) | Font | Gói (phiên bản ghim) | Giấy phép | Bản quyền (theo file `LICENSE` trong gói) |
|---|---|---|---|---|---|
| Hồ sơ (mặc định) | `ho-so` | Be Vietnam Pro | `@fontsource/be-vietnam-pro` 5.3.0 | SIL OFL 1.1 | The Be Vietnam Pro Project Authors |
| Biên bản | `bien-ban` | Source Serif 4 | `@fontsource/source-serif-4` 5.3.1 | SIL OFL 1.1 | Gói ghi "Google Inc."; Source Serif gốc do Adobe phát hành, cũng theo OFL |
| Dễ đọc | `de-doc` | Lexend | `@fontsource/lexend` 5.3.0 | SIL OFL 1.1 | The Lexend Project Authors |
| Máy chữ | `may-chu` | IBM Plex Mono | `@fontsource/ibm-plex-mono` 5.3.0 (đã có từ trước) | SIL OFL 1.1 | IBM Corp. |

Nguồn: Fontsource (fontsource.org), file woff2 tự lưu trữ cùng site, không gọi Google Fonts hay CDN nào. OFL cho phép nhúng font vào trang web, kể cả trang thương mại, miễn là không bán riêng file font.

## Kiểm tra tiếng Việt

`pnpm check:fonts` (file `tools/check-fonts.mjs`, dùng thư viện `fontkit` 2.0.4) mở từng file woff2 và xác nhận mỗi hồ sơ, ở cả trọng lượng 400 và 700, có glyph cho:
- chuỗi thử của SPEC §7: `Lê Thái Trung — Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ố Ồ Ổ Ỗ Ộ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự`;
- mọi chữ cái tiếng Việt, cả 6 thanh, chữ thường và chữ hoa.

Tổng cộng 179 ký tự. Kết quả ngày 28/10/2026: **cả 4 hồ sơ đều đủ**. Script trả về mã lỗi khi thiếu glyph, có test cho đường thất bại ở `scripts/check-fonts.test.mjs`.

## Tải và dung lượng

- Mỗi hồ sơ dùng 2 trọng lượng (400, 700), định dạng woff2, `font-display: swap`. Fontsource chia font theo `unicode-range`, nên trình duyệt chỉ tải tập con trang cần: latin và vietnamese cho trang tiếng Việt và tiếng Anh. Tập latin-ext chỉ tải khi gặp ký tự thuộc tập đó.
- Font của ba hồ sơ phụ chỉ được khai báo. Trình duyệt chỉ tải khi có chữ dùng tới font đó. Thực tế có hai lúc:
  - khi người xem chọn hồ sơ: font được tải xong rồi mới áp, nên chữ chỉ đổi một lần;
  - khi mở bảng "Aa": mỗi tên hồ sơ được viết bằng chính font của nó, nên trình duyệt tải trọng lượng 400 của ba font phụ.

Lưu ý: trong CSS của Fontsource, dải `unicode-range` của tập latin-ext chồng lên dải của tập vietnamese (chữ Ă, Ỳ…). Vì vậy trang tiếng Việt tải luôn cả latin-ext. Với hồ sơ mặc định (Be Vietnam Pro) và "Biên bản" (Source Serif 4), dự án tự khai báo `@font-face` chỉ gồm latin + vietnamese, vì nội dung trong `content/` không có ký tự nào ngoài hai tập này (đã kiểm tra ngày 28/10/2026). Nếu sau này nội dung cần ký tự latin-ext, ký tự đó sẽ hiện bằng font dự phòng; khi ấy cần khai báo thêm tập latin-ext.

Dung lượng font mà trang `/vi/` thực tế tải cho từng hồ sơ (file woff2 như được phục vụ, trọng lượng 400 + 700, đo bằng `e2e/reading.e2e.ts`). Ngân sách là 70 KB mỗi hồ sơ.

| Hồ sơ | Dung lượng | Số file |
|---|---|---|
| Hồ sơ (Be Vietnam Pro) | 67,3 KB (trước P27 là 94,2 KB) | 4 |
| Biên bản (Source Serif 4) | 54,5 KB | 4 |
| Dễ đọc (Lexend) | 66,9 KB | 6 |
| Máy chữ (IBM Plex Mono) | Cùng font với nhãn mono, nên đã tải sẵn cùng mọi trang; thêm trọng lượng 700 | — |

## Font dự phòng (chống nhảy bố cục)

Mỗi font phụ có một font hệ thống làm dự phòng, chỉnh bằng `size-adjust`, `ascent-override`, `descent-override` và `line-gap-override` để khớp kích thước với font web. Các con số do `tools/font-fallbacks.mjs` tính từ chính file font. Lệnh này đọc font hệ thống trong `C:\Windows\Fonts` (chỉ đọc), rồi in ra CSS để chép vào `src/styles/fonts.css`.

| Font web | Dự phòng |
|---|---|
| Source Serif 4 | Georgia |
| Lexend | Arial |
| IBM Plex Mono | Courier New |

## In và PDF

Bản in luôn dùng hồ sơ mặc định ở cỡ 100%: các quy tắc hồ sơ và cỡ chữ nằm trong `@media not print`.

## Tên gọi

Hồ sơ "Dễ đọc" chỉ là tên gọi. Trang không quảng cáo nó là hỗ trợ cho chứng khó đọc (UX-v3 mục 4, ROADMAP 27.7).
