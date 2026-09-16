# Refresh Token — ghi chú triển khai

Cách `docs/FE_GUIDELINE_REFRESH_TOKEN.md` được hiện thực trong app này. Guideline
viết cho SPA chạy trên browser (localStorage + fetch interceptor); app này là
Next.js App Router gọi API **từ server**, token nằm trong cookie httpOnly và
browser không bao giờ thấy token. Các bất biến giữ nguyên, cơ chế thì khác.

## Kiến trúc

```
proxy.ts                  chỗ DUY NHẤT gọi POST /auth/refresh
lib/auth/tokens.ts        cookie pair + đọc exp — writeSessionCookies() là writer duy nhất
lib/auth/refresh.ts       single-flight + grace window cho token vừa rotate
lib/auth/session.ts       API cho app code: requireAccessToken / reauthenticate / clearSession
app/session/refresh/      fallback nếu Proxy không chạy → hard logout
```

**Vì sao refresh phải nằm ở Proxy.** Server Component không được ghi cookie
(giới hạn của Next: HTTP không cho set cookie sau khi stream đã bắt đầu). Refresh
mà không ghi được token mới = mất session, vì token cũ đã chết ngay khi rotate.
Proxy chạy trước **mọi** request — page render, Server Action POST, Route Handler
— và ghi được cookie trên response của tất cả, nên nó là chỗ duy nhất vừa an toàn
vừa đủ phủ. App code không bao giờ tự refresh.

Hai chế độ:

| Chế độ    | Khi nào                                                | Làm gì                                                                 |
| --------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| Proactive | có `rt`, `at` thiếu hoặc gần hết hạn                   | rotate, forward token mới vào chính request đó, `Set-Cookie` cả cặp     |
| Forced    | app code nhận 401 → `reauthenticate()` → `/session/refresh` | rotate đúng **một** lần (chặn bởi cookie `rg`), thất bại thì hard logout |

## Ba tầng chống refresh song song

1. `inflight` map trong `lib/auth/refresh.ts` — nhiều request cùng một refresh
   token thì await cùng một promise. Thay cho single-flight trong tab của SPA.
2. `rotated` grace map (60s) — request đến muộn với token **đã bị rotate** (browser
   chưa kịp nhận `Set-Cookie`) nhận lại cặp token mới từ memory thay vì đâm vào
   reuse detection. Đây là thay thế cho bước "đọc lại storage sau khi giành lock"
   (§3.2), thứ không làm được ở server: mỗi request mang một snapshot cookie riêng.
3. Không cần `navigator.locks`: nhiều tab cùng đi qua một tiến trình server, chứ
   không phải hai heap JS riêng như SPA.

**Giới hạn phải biết:** cả hai map là memory của một tiến trình. Chạy nhiều
instance sau load balancer thì hai instance refresh song song vẫn có thể trigger
reuse detection → mất session. Chạy single-instance, bật sticky session, hoặc
chuyển hai map sang storage dùng chung (Redis) trước khi scale ngang.

## Checklist §6 → chỗ tương ứng

| Guideline                                          | Ở đây                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Chỉ một chỗ gọi `POST /auth/refresh`               | `proxy.ts`; `lib/api/auth.ts#refreshSession` không được gọi trực tiếp     |
| Một hàm duy nhất ghi token, ghi cả cặp             | `tokens.ts#writeSessionCookies`                                          |
| Single-flight, reset trong `finally`               | `refresh.ts#refreshTokens`                                               |
| Cross-tab lock + kiểm tra lại sau khi giành lock   | `inflight` + `rotated` grace map (xem trên)                              |
| Retry sau refresh đúng một lần                     | cookie `rg` (10s) trong `proxy.ts#forcedRefresh`                         |
| Loại `/auth/login|register|google|refresh` khỏi 401 handling | `NO_REFRESH_PATHS`; login/register form tự map 401 thành lỗi credentials |
| `AuthExpiredError` (xoá token) vs mạng/5xx (giữ)   | `refresh.ts`; `proxy.ts#ensureFreshAccessToken` và `#forcedRefresh`       |
| Hard logout xoá storage trước                      | `tokens.ts#clearSessionCookies`, gọi trước mọi redirect                  |
| Logout gọi `/auth/logout` rồi luôn xoá trong `finally` | `app/logout/route.ts`, `app/(auth)/actions.ts#logoutAction`           |
| Không hardcode TTL, đọc `exp`                      | `tokens.ts#isAccessTokenExpiringSoon` (skew bị chặn ở ¼ lifetime khi có `iat`) |
| Dùng `data` trong response refresh                 | không cần: page tự đọc profile theo request, không có user store client   |

Những mục không áp dụng: `BroadcastChannel` (xoá cookie là mọi tab mất session ở
request kế tiếp), fallback Web Locks (§3.6), và cảnh báo XSS localStorage —
token không bao giờ ra tới browser.

## Đã kiểm chứng

Chạy với mock API implement rotation + reuse detection + revoke (32 assertion, all
pass), gồm: 5 request song song lúc token vừa hết hạn → **1** lần
`/auth/refresh`, cả 5 đều 200; request đến muộn với token đã rotate → không bị
đá ra; token rác → hard logout không loop; session bị revoke → bounce một lần rồi
logout; mất backend → **giữ** cookie; logout khi access token đã hết hạn → refresh
trước rồi revoke. Contract của backend thật (`localhost:8080`) cũng đã đối chiếu:
401 `unauthorized` với token sai, 400 khi thiếu field, logout đòi Bearer.

## Còn hở

- **Cookie không chia sẻ sang subdomain.** Cookie session là host-only (không set
  `domain`), nên `admin.${ROOT_DOMAIN}` không nhận được — cổng admin trong
  `proxy.ts` chưa dùng được cho tới khi scope cookie theo `.${ROOT_DOMAIN}`. Đây
  là tình trạng có từ trước, không phải do luồng refresh.
- **`LoginResponse.refresh_token`** được coi là bắt buộc theo §1.1. Nếu backend
  chưa trả field này, `writeSessionCookies` chỉ ghi `at` và xoá `rt` → session
  chạy tới khi access token hết hạn rồi về `/login`, không refresh.
