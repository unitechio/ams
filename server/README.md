# AMS Server

Backend Go cho hệ thống AMS, tập trung vào xác thực, RBAC theo permission code, audit log và các luồng bảo mật vận hành.

## Tính năng chính

- Đăng nhập bằng username/password với `bcrypt`
- Refresh token và thu hồi token theo user
- Ép đổi mật khẩu khi:
  - tài khoản dùng `one_time_password`
  - mật khẩu đã hết hạn
- Password policy:
  - tối thiểu 8 ký tự
  - có chữ hoa, chữ thường, số, ký tự đặc biệt
  - chặn reuse các mật khẩu gần đây
- Khóa tạm tài khoản khi đăng nhập sai nhiều lần
- Quản lý user, role, permission, menu
- Audit log và auth history
- 2FA/TOTP hooks cơ bản

## Cấu trúc

```text
server/
├── cmd/server                 # entrypoint
├── internal/authorization     # permission registry, scope
├── internal/delivery/http     # router + handlers
├── internal/domain            # entity + repository interface
├── internal/infrastructure    # persistence, db bootstrap
├── internal/jwt               # JWT service
├── internal/middleware        # auth, permission, audit
├── internal/usecase           # business logic + unit test
└── migrations                 # SQL schema notes
```

## Luồng auth hiện có

### Login

`POST /api/v1/auth/login`

Response ngoài `access_token`, `refresh_token`, `user` còn có:

- `must_change_password`
- `password_expired`
- `password_change_reason`

Frontend phải giữ user ở màn đổi mật khẩu nếu `must_change_password = true`.

### Đổi mật khẩu bắt buộc

`PUT /api/v1/auth/change-password`

Khi đổi thành công:

- xóa cờ `one_time_password`
- xóa trạng thái hết hạn nếu mật khẩu cũ đã expired
- thu hồi refresh token cũ
- lưu password history

### Admin reset password

`POST /api/v1/users/:id/reset-password`

Payload:

```json
{
  "password": "AdminReset@123",
  "one_time_password": true
}
```

Khuyến nghị bật `one_time_password = true` cho reset thủ công.

## Chạy local

### Yêu cầu

- Go 1.22+
- PostgreSQL

### Cài đặt

```bash
cd server
go mod download
```

### Chạy test

```bash
go test ./...
```

### Chạy server

Entrypoint chính nằm ở `cmd/server`.

```bash
cd server
go run ./cmd/server
```

## Ghi chú schema

- GORM `AutoMigrate` đang là nguồn migrate thực tế khi app khởi động.
- Bảng user chính là `sys_users`.
- `password_history` được lưu trực tiếp trên user để enforce password history đơn giản và đủ ổn định cho app hiện tại.

## Roadmap hợp lý tiếp theo

1. Argon2id migration với backward-compatible hash verification
2. Refresh token rotation + reuse detection
3. Trusted device và device/session persistence thật
4. Email OTP / TOTP verification hoàn chỉnh
5. Step-up authentication cho thao tác nhạy cảm
6. SSO/OAuth2/SAML cho môi trường enterprise
