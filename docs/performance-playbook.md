# Performance playbook — đo, tìm nguyên nhân, giảm giật

Dành cho Claude Code. Windows 11, pnpm. Mọi lệnh phải chạy được trên Windows (ưu tiên script Node, không dùng lệnh chỉ có ở bash).

## 0. Quy tắc
1. **Đo trước, tối ưu sau.** Mỗi thay đổi hiệu năng ghi số trước/sau vào `docs/perf-log.md` (ngày, phase, chỉ số, giá trị, máy). Không có số thì không tối ưu.
2. **Đo trên bản build thật:** `pnpm build:prod` rồi `pnpm preview` (nếu chưa có script thì `pnpm astro preview`). Không đo trên `pnpm dev`: nó chậm hơn bản thật và làm số liệu sai.
3. So sánh trên **cùng một máy**, đóng ứng dụng nặng, chạy 3 lần lấy trung vị. Số tuyệt đối trên máy này không đại diện cho người xem; dùng để so sánh trước/sau.
4. Thêm thư viện (lighthouse, web-vitals, fontkit/opentype.js) phải hỏi chủ dự án, ghim phiên bản, là devDependency.

## 1. Chỉ số và ngưỡng
| Chỉ số | Ngưỡng "tốt" | Ghi chú |
|---|---|---|
| LCP | ≤ 2.5 s | Ngưỡng Google công bố cho Core Web Vitals |
| INP | ≤ 200 ms | Đo bằng tương tác thật (bấm lens, chuyển chế độ, mở dòng, mở bảng "Aa") |
| CLS | ≤ 0.1 | Mục tiêu của dự án: gần 0, nhất là khi đổi hồ sơ chữ |
| Lighthouse performance | ≥ 90 mobile, ≥ 95 desktop | Mô phỏng, chỉ để so sánh |
| Thời gian khung (p95) | ≤ 20 ms; ≤ 40 ms khi CPU chậm 4× | Đo khi lướt chuột và cuộn |

## 2. Lệnh đo
Thư mục kết quả `.perf/` (thêm vào `.gitignore`).

```
pnpm build:prod
pnpm preview --port 4321
```
**Lighthouse** (cài làm devDependency, ghim phiên bản; cần Chrome/Chromium, nếu không tìm thấy thì đặt `CHROME_PATH` trỏ tới Chromium của Playwright):
```
pnpm exec lighthouse http://localhost:4321/vi/ --only-categories=performance,accessibility --output=json --output-path=.perf/lh-mobile.json --chrome-flags="--headless=new" --quiet
pnpm exec lighthouse http://localhost:4321/vi/ --preset=desktop --only-categories=performance,accessibility --output=json --output-path=.perf/lh-desktop.json --chrome-flags="--headless=new" --quiet
```
Viết `tools/perf/lh-summary.mjs` đọc JSON, in điểm + LCP/INP-proxy(TBT)/CLS, thất bại khi dưới ngưỡng.

**Dung lượng:** `tools/perf/size-report.mjs` duyệt `dist/`, in dung lượng gzip/brotli của JS, CSS, font, ảnh, JSON theo nhóm; thất bại khi vượt ngân sách ở `SPEC.md` mục 10 và ngân sách mỗi hồ sơ chữ (≤ 70 KB gzip).

**Thời gian khung khi lướt chuột (Playwright):**
```ts
const client = await page.context().newCDPSession(page);
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // lần chạy thứ hai
await page.addInitScript(() => {
  window.__frames = [];
  let last = performance.now();
  const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
// lướt chuột qua sổ cái, biểu đồ, bản đồ trong ~3 s, rồi cuộn trang
for (let i = 0; i < 180; i++) await page.mouse.move(100 + i * 6, 200 + (i % 60) * 8, { steps: 2 });
const frames = await page.evaluate(() => window.__frames.slice(5));
// tính p95, đếm khung > 33 ms; so với ngưỡng
```
Tạo `tools/perf/frames.spec.ts` chạy hai lần (không giảm tốc và CPU chậm 4×).

**Khung dài / tác vụ dài:** nếu trình duyệt hỗ trợ, quan sát `long-animation-frame` (Chromium) và `longtask`; kiểm tra bằng `PerformanceObserver.supportedEntryTypes` trước.

**INP và LCP bằng thư viện `web-vitals`:** nạp bản IIFE trong `node_modules/web-vitals/dist/` (kiểm tra đúng tên tệp sau khi cài) bằng `page.addScriptTag`, gọi `onINP`, `onLCP`, `onCLS` với `reportAllChanges: true`, rồi thực hiện các tương tác: bấm lens, đổi chế độ, mở/đóng 3 dòng sổ cái, mở bảng "Aa", đổi hồ sơ chữ.

**Dấu vết:** `pnpm exec playwright test --trace on`, xem bằng `pnpm exec playwright show-trace <file>`. Dùng khi một bài đo đỏ để tìm nguyên nhân.

Thêm vào `package.json`: `perf:size`, `perf:lh`, `perf:frames`, và `perf` chạy cả ba. Script phải là Node/Playwright thuần để chạy trên Windows.

## 3. Nguyên nhân hay gặp và cách xử lý
1. **Hoạt ảnh làm bố cục chạy lại.** Chỉ animate `transform`, `opacity`, `clip-path`. Lưu ý: mở/đóng dòng sổ cái đang dùng chuyển `grid-template-rows` (0fr↔1fr) và đây **là hoạt ảnh làm bố cục chạy lại mỗi khung**. Đo ở P20.7; nếu vượt ngưỡng thì đổi sang cách không đụng bố cục.
2. **Con trỏ/vòng/khung chọn:** một vòng `requestAnimationFrame`, `pointermove` passive chỉ ghi tọa độ, không `getBoundingClientRect` trong vòng lặp (đo khi `pointerenter` rồi lưu), chỉ ghi `transform`, dừng vòng khi chuột đứng yên 600 ms, tạm dừng khi tab ẩn. Độ trễ nội suy ~0.3: thấp hơn gây cảm giác lag, cao hơn mất hiệu ứng.
3. **`will-change`:** chỉ đặt trên phần tử thật sự chuyển động (vòng, khung chọn, vầng tối) và bỏ sau khi hoạt ảnh một lần kết thúc. Đặt cho cả trang là tốn bộ nhớ GPU.
4. **Tránh** `backdrop-filter`, `filter: blur()` diện rộng, animate `box-shadow`, bộ lọc SVG lớn. Vầng "nhìn đêm" phải dùng phần tử lớn **di chuyển bằng `transform`**, không đổi `background` mỗi khung.
5. **`content-visibility: auto` + `contain-intrinsic-size`** cho các khối lớn ở dưới màn hình (biểu đồ, bản đồ, "Giới hạn và rủi ro"). **Không** áp cho từng dòng sổ cái (neo liên kết `#claim-*`, tìm trong trang, hoạt ảnh mở dòng bị ảnh hưởng).
6. **Cuộn/hiện dần:** dùng `IntersectionObserver`, không dùng sự kiện `scroll` để tính toán.
7. **Biểu đồ:** SVG tĩnh dựng lúc build; tương tác chỉ dịch chuyển hai đường và đổi một khung chữ. Không dựng lại SVG khi di chuột.
8. **Bản đồ:** kiểm tra số lượng path và độ chi tiết của TopoJSON. Nếu nặng, đơn giản hóa bằng công cụ có sẵn (hỏi chủ dự án trước khi cài). Zoom/di chuyển phải dùng `transform` trên một nhóm, không chiếu lại từng path mỗi khung. **Đo trước**, tui chưa đọc phần cài đặt bản đồ hiện tại.
9. **View Transitions:** chụp ảnh nền tốn tài nguyên và làm LCP lượt xem lặp trên điện thoại chậm hơn (số liệu công bố khoảng 70 ms; nhiều hơn khi CPU yếu). Dùng ở màn ≥ 768 px, khóa không cho hai chuyển cảnh chạy chồng, luôn có thoái lui mờ dần và reduced-motion.
10. **Font:** chỉ nạp font mặc định lúc đầu; woff2 tập con Latin + Latin-ext + Việt, tối đa 2 trọng lượng; `font-display: swap`; font dự phòng có `size-adjust`/`ascent-override`; chỉ `preload` đúng một tệp mặc định. Hồ sơ chữ khác nạp khi chọn.
11. **Ảnh:** AVIF/WebP, `width`/`height` rõ ràng, `decoding="async"`, `fetchpriority="high"` chỉ cho ảnh LCP; biến thể `high` của chân dung nạp lúc rảnh.
12. **JS:** không dùng framework cho cổng/con trỏ; script nhỏ, `type="module"`, kiểm tra điều kiện thiết bị **trước khi nạp** mã con trỏ; không có thư viện hoạt ảnh.
13. **Chạy lại khi tab ẩn:** dừng mọi `requestAnimationFrame` khi `document.hidden`.
14. **Cache:** tệp có hash nên cache lâu (khi deploy), HTML không cache lâu. Chỉ áp khi chủ dự án yêu cầu deploy.

## 4. Quy trình khi một bài đo đỏ
1. Chạy lại 3 lần để loại nhiễu.
2. Bật dấu vết Playwright (hoặc Performance panel) và tìm tác vụ dài/khung dài.
3. Xác định phần tử gây ra (con trỏ, chuyển cảnh, sổ cái, bản đồ, font).
4. Sửa **một** thứ, đo lại, ghi vào `docs/perf-log.md`.
5. Nếu hiệu ứng không đạt ngưỡng sau khi tối ưu hợp lý: tắt trên thiết bị yếu hoặc xóa, theo `UX-v3.md` mục 8. Không hạ ngưỡng.
