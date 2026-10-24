# ROADMAP — Cupid Dossier

Lộ trình từng bước cho Claude Code. Nguồn sự thật: `SPEC.md` (chức năng, riêng tư), `UX.md` (hành vi, chuyển động), `DESIGN.md` (token, chữ). File này chỉ nói **làm gì, theo thứ tự nào, kiểm chứng ra sao**.

## Trước khi bắt đầu (chủ dự án làm, khoảng 5 phút)
1. Trong VS Code chọn **File > Open Folder** và mở `F:\Dev\Projects\cupid-dossier` (không mở `F:\Dev`). Chạy Claude Code từ chính thư mục này, dù dùng tiện ích hay terminal tích hợp.
2. **Tạo commit nền bằng tay:** panel Source Control > Initialize Repository > stage tất cả > commit với lời nhắn như "docs: baseline spec". Lý do: bộ đặc tả hiện chỉ nằm trên đĩa, không có bản sao nào. Có commit nền thì lỡ mất file vẫn khôi phục được, và diff của P0 sẽ hiện rõ trong VS Code.
3. Kiểm tra trong thư mục chưa có ảnh cá nhân nào. Repo (nếu có) chỉ ở máy hoặc ở chế độ private.
4. Cài tiện ích **Astro** cho VS Code để tô màu cú pháp. Không cần thêm gì khác.
5. Mỗi phase bắt đầu một cuộc trò chuyện mới với Claude Code, và dán prompt mẫu bên dưới.

## Quy tắc xuyên suốt
1. **Chức năng trước, chuyển động sau.** Mỗi toggle được dựng chạy đúng và có test trước. Lớp hiệu ứng thêm ở phase riêng (P4, P5, P7). Làm vậy mỗi thay đổi nhỏ, dễ kiểm, dễ lùi.
2. Mỗi bước nhỏ (khoảng một giờ, vài trăm dòng thay đổi trở xuống). Làm đúng thứ tự, mỗi bước kết thúc bằng lệnh `verify` và đọc kết quả thật.
3. **Dừng ở mỗi Checkpoint.** Báo cáo theo mục 6 của dev-discipline, chờ chủ dự án nói "ok" rồi mới sang phase sau. Việc commit do chủ dự án quyết.
4. Dependency mới cần một dòng lý do (dev-discipline mục 2). Không cài công cụ toàn cục.
5. Một bước thất bại sau hai lần thử: dừng, báo nguyên nhân, hỏi. Không lặp mãi.
6. Đặc tả mâu thuẫn hoặc thiếu: hỏi, không tự đoán. Không điền chỗ `null` trong `content/`.
7. Mọi script chạy được trên Windows 11.

## Prompt mẫu
**Phase P0 (dán nguyên văn):**
```
Đọc CLAUDE.md, SPEC.md, UX.md, DESIGN.md và ROADMAP.md trong thư mục này. Áp dụng dev-discipline (đã nằm trong CLAUDE.md).

Nhiệm vụ: làm đúng Phase P0 trong ROADMAP.md (các bước 0.1 đến 0.8), theo thứ tự.

Trước khi viết bất cứ thứ gì, nói lại trong tối đa 5 dòng: mục tiêu, giả định, kế hoạch. Chỉ hỏi tôi khi một quyết định khó lùi lại (xoá hoặc ghi đè file, thay đổi schema) mà đặc tả chưa trả lời.

Ràng buộc:
- Tuyệt đối không xoá, ghi đè hay "clear" file hiện có (CLAUDE.md, SPEC.md, UX.md, DESIGN.md, ROADMAP.md, content/, docs/). Khi tạo dự án Astro, không chọn bất kỳ lựa chọn nào xoá hoặc ghi đè thư mục; dựng ở thư mục tạm rồi sao chép sang, hoặc dựng tay.
- Không commit, không push, không deploy.
- Không đọc, in hay ghi bí mật (.env*, mật khẩu). Không đụng tới thứ gì ngoài thư mục dự án này.
- Dependency mới phải có một dòng lý do. Mặc định không dùng React.
- Không điền các chỗ null trong content/.
- Mỗi bước kết thúc bằng lệnh verify; đọc kết quả thật, không viết "chắc chạy được".

Khi xong P0: dừng, báo cáo theo mục 6 của dev-discipline (tối đa 10 dòng, tiếng Việt) kèm kết quả các lệnh verify. Không sang P1.
```

**Các phase sau (thay N và danh sách bước):**
```
Đọc CLAUDE.md, SPEC.md, UX.md, DESIGN.md và ROADMAP.md. Áp dụng dev-discipline.

Checkpoint của phase trước đã được tôi duyệt. Làm đúng Phase PN trong ROADMAP.md (các bước N.1 đến N.k), theo thứ tự. Trước khi viết gì, nói lại mục tiêu, giả định, kế hoạch trong tối đa 5 dòng.

Giữ nguyên các ràng buộc của P0 (không xoá hoặc ghi đè file hiện có ngoài phạm vi phase, không commit, không bí mật, dependency mới có lý do, không điền null trong content/, mỗi bước có verify chạy thật).

Khi xong: dừng, báo cáo theo mục 6 của dev-discipline. Không sang phase sau.
```

## P0 — Khung dự án
| Bước | Việc | Verify |
|---|---|---|
| 0.1 | Kiểm tra môi trường (Node, pnpm đã có ở `F:\Dev\Tools\nodejs`); kho pnpm phải ở ổ F; trình duyệt của Playwright đặt về `F:\Dev\Data\playwright` (đặt `PLAYWRIGHT_BROWSERS_PATH` trong script dự án, không đặt biến toàn cục) | `node -v`, `pnpm -v` in ra phiên bản; `pnpm store path` nằm dưới `F:\Dev\Data`. Lỗi PATH thì báo, không cài toàn cục |
| 0.2 | Xác nhận đã có repo git với commit nền do chủ dự án tạo. Nếu chưa có thì **dừng và nhắc chủ dự án**, không tự `git init` hay commit | `git log` có ít nhất một commit; `git status` sạch; `.gitignore` đã chặn `.env*` |
| 0.3 | Tạo dự án Astro tối giản. Một số trình tạo dự án cho phép xoá hoặc ghi đè thư mục hiện tại: **tuyệt đối không chọn các lựa chọn đó**. Dựng ở thư mục tạm rồi sao chép sang, hoặc dựng tay. Không được đụng `CLAUDE.md`, `SPEC.md`, `DESIGN.md`, `UX.md`, `ROADMAP.md`, `content/`, `docs/` | `pnpm build` qua; `git status` cho thấy các file cũ không đổi |
| 0.4 | TypeScript strict, script `typecheck` | `pnpm typecheck` |
| 0.5 | Schema Zod theo SPEC mục 6, content collections (đối chiếu tài liệu Astro hiện hành), unit test cho từng ràng buộc | `pnpm test`: có test "classified có thêm chữ thì bị từ chối", "verified không bằng chứng thì bị từ chối", "mục open thiếu title và org, hoặc thiếu period, thì bị từ chối" |
| 0.6 | `scripts/check-leaks.mjs` theo SPEC mục 9, kèm fixture thử | `pnpm check:leaks` qua trên bản build sạch; **fail** trên fixture chứa số điện thoại giả |
| 0.7 | Cổng sổ cái cho build production (`pnpm build:prod`) | Hiện tại **được phép fail** vì chưa có mục nào verified, nhưng phải fail đúng lý do và in danh sách mục thiếu bằng chứng |
| 0.8 | Script `pnpm verify` = typecheck + test + build + check:leaks | `pnpm verify` qua |

**Checkpoint P0:** chủ dự án chạy `pnpm dev`, thấy trang trống chạy.

## P1 — Token, phông, khung trang, công tắc chế độ (chưa hiệu ứng)
| Bước | Việc | Verify |
|---|---|---|
| 1.1 | Token CSS hai chế độ từ DESIGN.md, script đo tương phản | `pnpm check:contrast` đạt WCAG AA ở cả hai chế độ |
| 1.2 | Phông tự lưu trữ có tập con tiếng Việt, trang thử chuỗi dấu ở SPEC mục 7 | Ảnh chụp e2e; chủ dự án nhìn đủ dấu |
| 1.3 | Layout cơ sở (header, main, footer) từ 360 px đến 1440 px | e2e chụp ở 360 và 1280, không cuộn ngang |
| 1.4 | Script inline đặt `data-mode` trước khi vẽ, nút chế độ chạy đúng (chưa hiệu ứng), `localStorage` bọc try/catch, `aria-live` | e2e: `data-mode` có trước khi vẽ; chặn storage vẫn chạy; Tab và Enter đổi được chế độ |
| 1.5 | Chế độ in = Giải mật | e2e `emulateMedia({ media: "print" })` thấy Giải mật, không có nút |

**Checkpoint P1:** chủ dự án duyệt bảng màu và chữ bằng mắt.

## P2 — Gate và chân dung
| Bước | Việc | Verify |
|---|---|---|
| 2.1 | Component Gate: mật danh, câu định vị từ `identity.json` | e2e: nội dung đúng, không có chuỗi ngoài `content/` |
| 2.2 | Ô chân dung nhận hai ảnh (`mat`, `giai-mat`) và ảnh giữ chỗ trung tính; pipeline ảnh xoá metadata | Script quét `dist/` không thấy EXIF; ảnh AVIF/WebP có `width` và `height` |
| 2.3 | Dấu đăng ký ở góc khung, nhãn monospace, "Hồ sơ cập nhật" theo ngày build | Ảnh chụp e2e |
| 2.4 | Trang thử 2 đến 3 phương án thể hiện tên thật ở chế độ Mật, route chỉ có ở dev | `dist/` **không** chứa route này |

**Checkpoint P2:** chủ dự án chọn phương án thể hiện tên, duyệt Gate, và quyết định về ảnh chân dung (UX mục 5).

## P3 — Sổ cái và khối che
| Bước | Việc | Verify |
|---|---|---|
| 3.1 | Component Ledger đọc `claims.json`, bỏ mục `hold`, huy hiệu UNVERIFIED chỉ ở dev | Unit test: mục `hold` không xuất hiện trong HTML |
| 3.2 | Component Redaction (SVG, độ dài ngẫu nhiên theo hạt giống build, không chứa chữ thật) | Unit test: HTML của mục `classified` chỉ có nhãn |
| 3.3 | Mở hoặc đóng mục (`grid-template-rows`), dùng được bằng bàn phím, `aria-expanded` | e2e bằng bàn phím |
| 3.4 | Liên kết "Xem bản giải mật": đổi chế độ, cuộn tới mục, giữ focus | e2e |
| 3.5 | Cổng sổ cái production hoạt động đúng | `pnpm build:prod` fail khi còn mục open chưa verified, và qua khi bộ dữ liệu thử đã verified |

**Checkpoint P3:** chủ dự án xem sổ cái và điền tiếp các chỗ `null` đã chờ.

## P4 — Chuyển động cho chế độ (signature 1 và 3)
| Bước | Việc | Verify |
|---|---|---|
| 4.1 | Declassify: View Transitions + `clip-path`, feature-detect, fallback crossfade | e2e với `reducedMotion: "reduce"` đổi tức thì; giả lập thiếu `startViewTransition` không báo lỗi |
| 4.2 | Thanh che co và phủ lại (so le, tối đa 8 thanh) | Đo thời lượng đúng bảng UX mục 3 |
| 4.3 | Tem công tắc lật, chân dung crossfade | Ảnh chụp trước và sau |
| 4.4 | Kiểm tra hiệu năng của lớp hiệu ứng | Không dịch bố cục ngoài ý muốn (CLS < 0,1); chỉ `transform`, `opacity`, `clip-path` được animate |

**Checkpoint P4:** chủ dự án xem cảm giác chuyển động trên máy thật, cả máy tính và điện thoại.

## P5 — Ngôn ngữ
| Bước | Việc | Verify |
|---|---|---|
| 5.0 | **Chọn cách chuyển ngôn ngữ.** Hiệu ứng Decode cần đổi tên ngay trên trang. Làm một bản thử nhỏ so sánh hai cách: (a) điều hướng mềm có hiệu ứng chuyển trang (kiểm tra router chuyển trang của Astro theo tài liệu hiện hành), (b) tự lấy trang kia và thay nội dung. Đưa kết quả cho chủ dự án chọn | Báo cáo ngắn nêu ưu nhược, số dòng mã, hành vi nút Back và URL; chủ dự án chọn |
| 5.1 | Định tuyến `/vi/` và `/en/` (i18n của Astro), `lang` đúng | e2e: thuộc tính `lang` đúng ở cả hai |
| 5.2 | Build fail nếu thiếu `vi` hoặc `en` ở bất kỳ chuỗi hiển thị nào | Test: xoá một chuỗi `en` thì `pnpm build` fail |
| 5.3 | Nút ngôn ngữ và Decode (signature 2), fallback quét mặt nạ cho RTL hoặc hệ chữ khác Latin | e2e: `aria-live` chỉ đọc tên mới; reduced motion đổi tức thì |
| 5.4 | Kiểm thử chuỗi tiếng Việt có dấu đi hết đường từ nội dung tới màn hình | Test so sánh chuỗi |
| 5.5 | Smoke test `dir="rtl"` bằng bản giả, không xuất bản | Ảnh chụp, không vỡ bố cục |

**Checkpoint P5:** chủ dự án đọc lại toàn bộ bản `en` (hoặc nhờ người duyệt).

## P6 — Bản đồ
| Bước | Việc | Verify |
|---|---|---|
| 6.1 | Lấy dữ liệu Natural Earth theo góc nhìn Việt Nam, **đọc điều khoản**, ghi `docs/LICENSES.md`. Điều khoản không cho phép thì dừng và hỏi | `docs/LICENSES.md` có kết luận |
| 6.2 | Chuyển TopoJSON lúc build, vẽ SVG bằng `d3-geo`, thể hiện và ghi nhãn Hoàng Sa, Trường Sa theo SPEC mục 8 | Ảnh chụp có đủ hai nhãn ở `vi` và `en` |
| 6.3 | Bốn điểm và hiệu ứng vẽ khi cuộn tới (một lần) | e2e kiểm tra chạy một lần; reduced motion hiện sẵn |
| 6.4 | Danh sách văn bản thay thế cho trình đọc màn hình | Kiểm tra bằng axe và đọc thử |
| 6.5 | Kiểm tra mạng | Log mạng của trang không có request bên thứ ba |

**Checkpoint P6 (bắt buộc):** chủ dự án duyệt bản đồ bằng mắt trước khi đi tiếp.

**Hết P6 là v1.**

## P7 — Hướng hồ sơ (v1.1)
| Bước | Việc | Verify |
|---|---|---|
| 7.1 | Cấu hình trọng số khối theo lens (không sửa `claims.json`) | Unit test thứ tự theo từng lens |
| 7.2 | UI "cửa vào", trạng thái ở `?lens=`, nút Back | e2e |
| 7.3 | FLIP sắp xếp lại | Reduced motion đổi tức thì; đo thời lượng |
| 7.4 | Kiểm tra nội dung | Ba lens cho ba thứ tự khác nhau nhưng cùng một tập id |

## P8 — Hoàn thiện
| Bước | Việc | Verify |
|---|---|---|
| 8.1 | Tắt JavaScript vẫn đọc được | e2e tắt JS thấy mọi mục công khai |
| 8.2 | Kiểm tra truy cập: axe và duyệt toàn trang bằng bàn phím | Không còn lỗi mức nghiêm trọng |
| 8.3 | Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95. Không đạt thì cắt hiệu ứng theo thứ tự ở UX mục 3 | Báo cáo Lighthouse |
| 8.4 | Trang 404, meta SEO trung tính, ảnh OG tĩnh, `noindex` trên mọi trang cho tới khi chủ dự án quyết định ra mắt | Kiểm tra bằng mắt và `check-leaks`; mọi trang trong `dist/` có `noindex` |
| 8.5 | Tổng kiểm | `pnpm verify` và `pnpm build:prod` đều qua (cần mọi mục công khai đã verified) |

**Checkpoint cuối:** chủ dự án duyệt toàn bộ trên máy thật.

## P9 — Phát hành (chỉ khi chủ dự án yêu cầu)
Commit do chủ dự án quyết, repo (nếu có) phải **private**. Mọi lần deploy, kể cả preview, dùng `pnpm build:prod`, vì link preview vẫn là một địa chỉ web. Xem thử nội dung chưa verified chỉ ở máy cục bộ. Deploy preview, chủ dự án xem, rồi mới lên production, gắn tên miền và gỡ `noindex`.
