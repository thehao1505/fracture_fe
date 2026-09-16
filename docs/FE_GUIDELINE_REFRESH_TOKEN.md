# FE Guideline — Refresh Token

Tài liệu triển khai phía frontend cho luồng refresh token của Fracture API. Mọi hành vi mô tả
ở đây đã được đối chiếu trực tiếp với code backend hiện tại (`internal/usecase/auth_usecase.go`,
`internal/handler/auth_handler.go`, `pkg/token/refresh.go`, `config/config.go`), không phải mô
tả dự kiến.

Tham chiếu chéo:

- Tổng quan auth + toàn bộ API khác: `docs/frontend-auth-guideline.md`
- Thiết kế backend: `docs/refresh-token-plan.md`
- Thử tay: `docs/postman/fracture.postman_collection.json`

---

## 0. Bốn quy tắc vàng

Nếu chỉ đọc một mục, đọc mục này:

1. **Refresh token là dùng-một-lần.** Mỗi lần refresh thành công, giá trị vừa gửi lên chết ngay,
   response trả về một giá trị mới. Ghi đè lập tức.
2. **Không bao giờ có hai request `/auth/refresh` chạy song song.** Request thứ hai dùng token
   đã bị rotate → backend coi là token bị trộm và **revoke toàn bộ session**. User bị đá ra
   khỏi mọi tab/thiết bị. Đây là failure mode đắt nhất của luồng này.
3. **401 từ `/auth/refresh` là điểm không thể quay đầu** → hard logout, không retry.
4. **Lỗi mạng ≠ hết phiên.** Chỉ xoá token khi _có_ response 401 từ `/auth/refresh`. `fetch`
   reject (mất wifi, backend chết) thì giữ nguyên token.

---

## 1. Hợp đồng API

Base URL: `{BASE_URL}/api/v1`.

### 1.1 `POST /auth/refresh` — public, **không** gắn `Authorization`

Endpoint này nằm trong nhóm route public (`main.go:84`), mục đích của nó là gia hạn _khi access
token đã hết hạn_. Gắn header `Authorization` vào cũng vô hại (backend không đọc), nhưng interceptor
của FE **không được** chặn request này lại vì access token hết hạn.

Request:

```jsonc
POST /api/v1/auth/refresh
Content-Type: application/json

{ "refresh_token": "0f5a3c8e-….AbCdEf123…" }
```

Response `200` — **giống hệt** envelope của `/auth/login` và `/auth/google`:

```jsonc
{
  "data": {
    "id": "0f5a3c8e-…",
    "email": "a@b.com",
    "name": "Tên",
    "created_at": "2026-08-07T10:00:00Z",
    "updated_at": "2026-08-07T10:00:00Z",
  },
  "access_token": "eyJhbGciOi…", // JWT mới
  "refresh_token": "0f5a3c8e-….XyZ…", // GIÁ TRỊ MỚI — phải ghi đè
  "token_type": "Bearer",
}
```

`data` trả sẵn user → dùng luôn để đồng bộ store, **không cần** gọi thêm API profile sau khi refresh.

### 1.2 Mã lỗi của `/auth/refresh`

| Status | Nguyên nhân                                                                                                                                                    | FE làm gì                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `400`  | Thiếu field `refresh_token` hoặc body không phải JSON hợp lệ (binding `required`)                                                                              | Bug của FE. Log lại, hard logout. **Không** retry                  |
| `401`  | Token sai định dạng, session không tồn tại, đã revoke (logout), đã hết hạn, quá hạn cứng 90 ngày, hoặc **đã bị rotate** (reuse detection / concurrent refresh) | **Hard logout ngay.** Không retry, không thử refresh token cũ khác |
| `5xx`  | Lỗi DB/server                                                                                                                                                  | Toast lỗi, **giữ nguyên token**, cho user thử lại                  |

Body lỗi luôn là `{ "error": "<message>" }`. Với 401 message hiện là `unauthorized` — **đừng
phân nhánh theo chuỗi message**, chỉ dựa vào status code.

### 1.3 `POST /auth/logout` — cần Bearer

Không có body. Backend revoke session trong Postgres (authoritative) và xoá entry Redis
(best-effort). Sau đó refresh token của session đó vĩnh viễn trả 401.

---

## 2. Những bất biến của backend mà FE phải thiết kế theo

|           | Access token                                            | Refresh token                                                                        |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Định dạng | JWT HS256                                               | Opaque, `"<sessionID>.<secret>"` (2 phần, cắt bởi dấu `.` đầu tiên)                  |
| Gửi bằng  | Header `Authorization: Bearer <token>`                  | Body JSON của `POST /auth/refresh`                                                   |
| TTL       | `JWT_EXPIRY` (mặc định `24h`, dự kiến rút xuống ~`15m`) | `REFRESH_TOKEN_EXPIRY` mặc định `720h` (30 ngày), **sliding** — reset mỗi lần rotate |
| Hạn cứng  | —                                                       | `REFRESH_TOKEN_MAX_LIFETIME` mặc định `2160h` (90 ngày) tính từ lúc tạo session      |
| Rotation  | Không (cấp lại nhưng **giữ nguyên `jti`**)              | **Có** — mỗi lần refresh đổi giá trị                                                 |

Bốn chi tiết dễ làm FE viết sai:

**a) `jti` của access token không đổi khi refresh.** Backend dùng `Reissue(userID, email, sessionID)`
— `jti` chính là session ID và giữ nguyên suốt đời session. Đừng dùng `jti` để phát hiện "token
đã được làm mới"; hãy so sánh chính chuỗi token hoặc claim `exp`.

**b) Sliding window nhưng có hạn cứng.** User hoạt động liên tục vẫn bị buộc đăng nhập lại sau
90 ngày kể từ lúc login. UI cần chấp nhận rằng logout đột ngột là hành vi hợp lệ, không phải bug.

**c) Reuse detection không có grace period.** Gửi một refresh token đã bị rotate → backend log
`SECURITY: refresh token reuse detected`, revoke session trong Postgres **và** revoke entry Redis
→ mọi access token của session đó chết ngay. Hai request refresh song song với cùng một token cũng
rơi vào đúng nhánh này (hoặc nhánh conflict khi rotate) → cả hai cùng 401.

**d) Redis fail-open.** Session checker có circuit breaker và **fail open** khi Redis lỗi
(`resilient_session_checker.go:39-43`): access token còn hạn vẫn được chấp nhận dù session đã bị
revoke. Hệ quả bắt buộc: **FE phải tự xoá token khỏi storage khi logout**, không được coi
"gọi `/auth/logout` thành công" là đủ để coi user đã đăng xuất.

Ghi chú CORS: backend không dùng cookie, không bật `Access-Control-Allow-Credentials`, chỉ allow
header `Authorization` và `Content-Type`. Nghĩa là **không có phương án httpOnly cookie** — token
bắt buộc do FE tự quản lý.

---

## 3. Triển khai

Kiến trúc tối thiểu, 4 lớp — mỗi lớp một file:

```
auth/storage.ts     // đọc/ghi token, ghi ATOMIC cả cặp
auth/refresh.ts     // single-flight + cross-tab lock, ĐÚNG MỘT nơi gọi /auth/refresh
auth/client.ts      // http client + interceptor 401 → refresh → retry 1 lần
auth/session.ts     // hardLogout, broadcast liên tab
```

### 3.1 Storage — ghi cả cặp trong một thao tác

```ts
// auth/storage.ts
const KEY = "fracture.auth";

export type Tokens = { access: string; refresh: string };

export const storage = {
  get(): Tokens | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },

  // Một hàm duy nhất được phép ghi token. Ghi lẻ một trong hai giá trị là
  // nguyên nhân số 1 của reuse detection.
  save(t: Tokens) {
    localStorage.setItem(KEY, JSON.stringify(t));
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
```

Quy tắc: **không** tồn tại `setAccessToken()` hay `setRefreshToken()` riêng lẻ ở bất kỳ đâu trong
codebase. Chỉ có `save({ access, refresh })`.

Lựa chọn nơi lưu: `localStorage` là mặc định hợp lý cho SPA (sống qua reload, backend không hỗ
trợ cookie). Access token in-memory + refresh token trong `localStorage` an toàn hơn trước XSS
nhưng phức tạp hơn khi đa tab — nếu chọn hướng này, mọi tab phải refresh lại lúc bootstrap.

### 3.2 Single-flight + cross-tab lock — phần quan trọng nhất

Hai tầng bảo vệ, thiếu tầng nào cũng vỡ:

- **Trong một tab**: một promise dùng chung, request thứ 2..n bám vào promise đang chạy.
- **Giữa các tab**: `navigator.locks` (Web Locks API) — hai tab có hai biến JS riêng nên
  single-flight trong tab không giúp gì.

```ts
// auth/refresh.ts
import { storage, type Tokens } from "./storage";
import { BASE } from "./config";

export class AuthExpiredError extends Error {}

let inflight: Promise<Tokens> | null = null;

/** Điểm vào duy nhất. Mọi nơi cần token mới đều gọi hàm này. */
export function refreshTokens(): Promise<Tokens> {
  if (inflight) return inflight; // tầng 1: single-flight trong tab
  inflight = withCrossTabLock().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function withCrossTabLock(): Promise<Tokens> {
  if (!navigator.locks) return performRefresh(storage.get()); // fallback: xem 3.6

  return navigator.locks.request("fracture-auth-refresh", async () => {
    // Tầng 2: tab thua lock vào đây SAU KHI tab thắng đã ghi token mới.
    // Đọc lại storage và kiểm tra — nếu đã có token còn hạn thì không refresh nữa.
    const current = storage.get();
    if (current && !isExpiringSoon(current.access)) return current;
    return performRefresh(current);
  });
}

async function performRefresh(current: Tokens | null): Promise<Tokens> {
  if (!current?.refresh) throw new AuthExpiredError("no refresh token");

  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh }),
    });
  } catch (e) {
    // Lỗi mạng: KHÔNG xoá token, KHÔNG coi là hết phiên.
    throw e;
  }

  if (res.status === 401 || res.status === 400) {
    throw new AuthExpiredError(`refresh rejected: ${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`refresh failed: ${res.status}`); // 5xx → cho phép thử lại sau
  }

  const body = await res.json();
  const tokens: Tokens = {
    access: body.access_token,
    refresh: body.refresh_token,
  };
  storage.save(tokens); // ghi cả cặp, atomically
  onUserRefreshed?.(body.data); // đồng bộ user store bằng data có sẵn
  return tokens;
}

export function isExpiringSoon(accessToken: string, skewMs = 60_000): boolean {
  const exp = readExp(accessToken);
  if (exp == null) return true; // không đọc được → coi như cần refresh
  return exp * 1000 - Date.now() < skewMs;
}

/** Decode CHỈ để đọc exp. Tuyệt đối không dùng claim JWT làm cơ sở phân quyền —
 *  FE không verify được chữ ký. */
function readExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}
```

Ba điểm dễ làm sai trong đoạn trên:

- `inflight` phải được reset trong `finally`, kể cả khi refresh thất bại — nếu không, một lần
  lỗi mạng sẽ khoá vĩnh viễn mọi lần refresh sau.
- **Kiểm tra lại token sau khi giành được lock** là bắt buộc. Bỏ bước này thì tab thua lock sẽ
  gọi refresh bằng token vừa bị tab thắng rotate đi → reuse detection.
- Phân biệt rõ ba loại thất bại: `AuthExpiredError` (401/400 → hard logout), lỗi mạng (giữ
  token), 5xx (giữ token).

### 3.3 Interceptor: 401 → refresh → retry đúng một lần

```ts
// auth/client.ts
import { storage } from "./storage";
import { refreshTokens, AuthExpiredError, isExpiringSoon } from "./refresh";
import { hardLogout } from "./session";
import { BASE } from "./config";

// 401 từ các endpoint này KHÔNG có nghĩa là "token hết hạn":
// /auth/login → sai mật khẩu, /auth/google → ID token không hợp lệ,
// /auth/refresh → phiên đã chết (tự xử lý trong refresh.ts).
const NO_REFRESH = [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/refresh",
];

export async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return send(path, init, false);
}

async function send(
  path: string,
  init: RequestInit,
  retried: boolean,
): Promise<Response> {
  const skip = NO_REFRESH.some((p) => path.startsWith(p));
  let tokens = storage.get();

  // Refresh chủ động: đỡ được một vòng 401 + retry.
  if (!skip && !retried && tokens?.access && isExpiringSoon(tokens.access)) {
    try {
      tokens = await refreshTokens();
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        hardLogout();
        throw e;
      }
      // lỗi mạng / 5xx: cứ gửi bằng token cũ, có thể vẫn còn hạn
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      ...init.headers,
    },
  });

  if (res.status !== 401 || retried || skip) return res;

  try {
    await refreshTokens();
  } catch (e) {
    if (e instanceof AuthExpiredError) hardLogout();
    return res; // trả 401 gốc cho caller
  }

  return send(path, init, true); // retry ĐÚNG một lần với token mới
}
```

Bản axios tương đương — lưu ý phải tự đánh dấu request đã retry để không lặp vô hạn:

```ts
http.interceptors.response.use(undefined, async (error) => {
  const cfg = error.config;
  const status = error.response?.status;
  const skip = NO_REFRESH.some((p) => cfg?.url?.startsWith(p));

  if (status !== 401 || skip || cfg._retried) throw error;
  cfg._retried = true;

  try {
    const { access } = await refreshTokens();
    cfg.headers.Authorization = `Bearer ${access}`;
    return http(cfg);
  } catch (e) {
    if (e instanceof AuthExpiredError) hardLogout();
    throw error;
  }
});
```

Ràng buộc bổ sung:

- **Retry tối đa một lần.** Nếu lần retry vẫn 401 → hard logout. Không có vòng lặp `while`.
- Request có body là `FormData`/stream đã tiêu thụ phải clone trước khi retry (hoặc giữ nguyên
  object body để tạo lại request từ đầu như code trên).
- Refresh phải nằm ở **tầng HTTP client**, không ở tầng component/hook.

### 3.4 Hard logout — một hàm duy nhất

```ts
// auth/session.ts
const channel =
  "BroadcastChannel" in globalThis
    ? new BroadcastChannel("fracture-auth")
    : null;

export function hardLogout(opts: { broadcast?: boolean } = {}) {
  storage.clear(); // XOÁ TRƯỚC — backend fail-open khi Redis down
  userStore.reset();
  if (opts.broadcast !== false) channel?.postMessage({ type: "logout" });
  router.replace("/login");
}

channel?.addEventListener("message", (e) => {
  if (e.data?.type === "logout") hardLogout({ broadcast: false }); // tránh vòng lặp
  if (e.data?.type === "refreshed") userStore.set(e.data.user);
});

/** Nút "Đăng xuất" của user. */
export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Lờ đi: mất mạng hay 5xx đều không được phép giữ token lại ở client.
  } finally {
    hardLogout();
  }
}
```

Nếu không dùng `BroadcastChannel`, lắng nghe event `storage` (bắn ở các tab khác khi
`localStorage` đổi) và hard logout khi key auth bị xoá.

### 3.5 Bootstrap khi mở/reload trang

```ts
export async function bootstrapAuth(): Promise<boolean> {
  const t = storage.get();
  if (!t?.refresh) return false; // chưa đăng nhập

  if (t.access && !isExpiringSoon(t.access)) {
    return true; // còn hạn → vào app luôn, không gọi API
  }

  try {
    await refreshTokens(); // đi đúng single-flight, không viết đường riêng
    return true;
  } catch (e) {
    if (e instanceof AuthExpiredError) {
      hardLogout();
      return false;
    }
    return true; // lỗi mạng: vào app ở trạng thái offline, đừng đá về /login
  }
}
```

Không được để màn hình nháy về `/login` khi token vẫn còn hạn — render route guard **sau khi**
`bootstrapAuth` resolve.

### 3.6 Fallback khi không có Web Locks

`navigator.locks` có trên mọi browser hiện đại nhưng thiếu ở một số WebView cũ. Fallback mềm:

```ts
// Khoá mềm qua localStorage + timestamp. Không đảm bảo tuyệt đối như Web Locks,
// nhưng thu hẹp cửa sổ đâm nhau xuống mức chấp nhận được.
const LOCK = "fracture.refresh.lock";
const LOCK_TTL = 10_000;

async function softLock<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const held = Number(localStorage.getItem(LOCK) ?? 0);
  if (now - held < LOCK_TTL) {
    await new Promise((r) => setTimeout(r, 300)); // đợi tab kia ghi token mới
    const t = storage.get();
    if (t && !isExpiringSoon(t.access)) return t as T;
  }
  localStorage.setItem(LOCK, String(now));
  try {
    return await fn();
  } finally {
    localStorage.removeItem(LOCK);
  }
}
```

Kèm theo: chỉ cho tab đang `document.visibilityState === 'visible'` chủ động refresh; tab ẩn đợi
đến khi được focus lại.

---

## 4. Bảng quyết định — gặp lỗi thì làm gì

| Tình huống                                    | Hành động                               | Có xoá token?        |
| --------------------------------------------- | --------------------------------------- | -------------------- |
| 401 trên endpoint protected (lần đầu)         | Refresh rồi retry 1 lần                 | Không                |
| 401 trên endpoint protected sau khi đã retry  | Hard logout                             | **Có**               |
| 401 trên `/auth/refresh`                      | Hard logout, không retry                | **Có**               |
| 400 trên `/auth/refresh`                      | Bug FE (thiếu field). Log + hard logout | **Có**               |
| 5xx trên `/auth/refresh`                      | Toast lỗi, cho thử lại                  | Không                |
| `fetch` reject (mất mạng, CORS, backend chết) | Toast offline, cho thử lại              | **Không**            |
| 401 trên `/auth/login`                        | Hiện "Email hoặc mật khẩu không đúng"   | Không (chưa từng có) |
| Không có refresh token trong storage          | Điều hướng `/login`                     | —                    |

Message 401 từ auth middleware có 5 biến thể: `missing or malformed authorization header`,
`invalid or expired token`, `token missing id`, `token has been revoked`,
`authorization check unavailable`. **Đừng phân nhánh theo chuỗi** — coi mọi 401 trên endpoint
protected là tín hiệu "thử refresh một lần".

---

## 5. Cạm bẫy đã biết

- **Nhiều component cùng gọi refresh trong `useEffect`.** → nhiều request song song → reuse
  detection. Refresh chỉ được tồn tại ở tầng HTTP client.
- **React 18 StrictMode** gọi effect hai lần ở dev → dễ nhìn thấy double refresh. Single-flight
  đúng sẽ hấp thụ được; nếu tab Network hiện **2** request `/auth/refresh` thì single-flight đang
  sai, không phải "do StrictMode".
- **Coi lỗi mạng là hết phiên** → user bị logout mỗi lần rớt wifi.
- **Ghi lẻ access token** (ví dụ chỉ `setAccessToken` sau refresh, quên refresh token) → lần
  refresh sau dùng token cũ → mất cả session.
- **Retry vòng lặp** không giới hạn khi backend liên tục trả 401 → bão request.
- **Hardcode TTL** (15 phút / 24 giờ) ở FE. Giá trị là env backend và sẽ đổi; luôn đọc `exp`.
- **Dùng claim JWT để phân quyền.** FE không verify được chữ ký; chỉ đọc `exp` để biết thời điểm
  refresh.
- **Không dọn state khi tab khác logout** → tab B vẫn hiển thị UI đã đăng nhập với token đã chết.

---

## 6. Checklist nghiệm thu

Code:

- [ ] Chỉ có **một** chỗ trong codebase gọi `POST /auth/refresh`
- [ ] Chỉ có **một** hàm được phép ghi token, ghi cả cặp access + refresh
- [ ] Single-flight trong tab (promise dùng chung, reset trong `finally`)
- [ ] Cross-tab lock (`navigator.locks`) + **kiểm tra lại token sau khi giành lock**
- [ ] Retry sau refresh đúng **một** lần
- [ ] `/auth/login`, `/auth/register`, `/auth/google`, `/auth/refresh` bị loại khỏi interceptor 401
- [ ] Phân biệt `AuthExpiredError` (xoá token) vs lỗi mạng/5xx (giữ token)
- [ ] `hardLogout()` xoá storage **trước**, rồi mới broadcast + điều hướng
- [ ] Nút logout gọi `/auth/logout` rồi luôn `hardLogout()` trong `finally`
- [ ] Không hardcode TTL token; `exp` đọc từ JWT
- [ ] Dùng `data` trong response refresh để đồng bộ user store, không gọi thêm API

Kịch bản test tay (đặt `JWT_EXPIRY=30s` ở backend cho dễ quan sát):

- [ ] Mở trang > 30s rồi thao tác → tự refresh, user không thấy gì bất thường
- [ ] Bắn 5 request song song đúng lúc token vừa hết hạn → tab Network chỉ có **1** request
      `/auth/refresh`, cả 5 request gốc đều thành công
- [ ] Mở 2 tab, đợi hết hạn, thao tác đồng thời ở cả hai → không tab nào bị đá ra
- [ ] Logout ở tab A → tab B về `/login` và xoá state
- [ ] Sửa tay `refresh_token` trong storage thành chuỗi rác → thao tác → hard logout sạch,
      không loop vô hạn
- [ ] Đặt `REFRESH_TOKEN_EXPIRY=60s`, để quá hạn rồi thao tác → hard logout
- [ ] Tắt backend giữa chừng → toast lỗi mạng, token **vẫn còn** trong storage
- [ ] Reload trang khi access token còn hạn → vào app ngay, **không** gọi `/auth/refresh`,
      không nháy `/login`
- [ ] Reload trang khi access token đã hết hạn nhưng refresh còn hạn → tự refresh, vào app
- [ ] Gọi `/auth/logout` rồi thử `/auth/refresh` với token cũ → 401 → hard logout
