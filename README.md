# AMS - Access Management System

[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/UI-shadcn-black.svg)](https://ui.shadcn.com/)

**AMS (Access Management System)** là một nền tảng hiện đại, hiệu năng cao chuyên biệt cho việc quản lý người dùng, phân quyền (RBAC) và theo dõi nhật ký hệ thống. Được xây dựng với các công nghệ mới nhất như React 19 và Tailwind CSS 4, dự án tập trung vào trải nghiệm người dùng tinh tế và kiến trúc code sạch sẽ.

---

## ✨ Tính năng nổi bật

### 1. Quản lý Truy cập (RBAC)
- **Phân quyền chi tiết**: Hệ thống phân quyền dựa trên mã (Permission Codes) linh hoạt.
- **Quản lý vai trò**: Thiết lập và gán quyền cho các nhóm vai trò khác nhau một cách trực quan.

### 2. Giám sát & Nhật ký (Audit Logs)
- **Truy vết chi tiết**: Ghi lại mọi tác động (Action), tài nguyên (Resource), IP và User Agent.
- **Payload Inspection**: Xem chi tiết dữ liệu Request/Response dưới dạng JSON với giao diện hiện đại.
- **Bộ lọc nâng cao**: Tìm kiếm và lọc nhật ký theo thời gian, người dùng và loại hành động.

### 3. Trải nghiệm người dùng (UX/UI)
- **Sidebar thông minh**: Hỗ trợ trạng thái thu gọn với hiệu ứng Glassmorphism và menu hover tinh tế.
- **Dark Mode**: Hỗ trợ giao diện sáng/tối đồng bộ toàn hệ thống.
- **Responsive**: Tối ưu hóa hiển thị trên mọi thiết bị (Mobile, Tablet, Desktop).
- **Smooth Animations**: Sử dụng Tailwind animations và hiệu ứng chuyển trang mượt mà.

### 4. Kiến trúc & Hiệu năng
- **Code Splitting**: Sử dụng React.lazy và Suspense để tối ưu hóa thời gian tải trang.
- **Clean Routing**: Cấu hình route tập trung (`routeConfig`), dễ dàng quản lý và mở rộng.
- **Type Safety**: Sử dụng TypeScript 100% để giảm thiểu lỗi runtime.

---

## 🛠 Công nghệ sử dụng

- **Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 5](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **Toasts**: [Sonner](https://sonner.emilkowal.ski/)
- **Components**: [Radix UI](https://www.radix-ui.com/)

---

## 🚀 Bắt đầu nhanh

### Yêu cầu hệ thống
- Node.js 18+
- npm hoặc yarn

### Cài đặt

1. Clone dự án:
   ```bash
   git clone https://github.com/owner/ams.git
   ```

2. Cài đặt dependency:
   ```bash
   npm install
   ```

3. Chạy môi trường phát triển:
   ```bash
   npm run dev
   ```

4. Build sản phẩm:
   ```bash
   npm run build
   ```

---

## 📂 Cấu trúc thư mục

```text
src/
├── auth/           # Logic xử lý phân quyền & Auth hooks
├── components/     # UI Components (layout, ui, common)
├── context/        # React Context (AuthContext, etc.)
├── guards/         # Route Guards (ProtectedRoute)
├── lib/            # Cấu hình API, utils (Axios, cn, etc.)
├── menu/           # Logic xử lý menu & Sidebar
├── pages/          # Các trang chính của hệ thống
├── routes/         # Cấu hình Routing (routeConfig)
└── App.tsx         # Root component
```

---

## 🛡 Bảo mật & Phân quyền

Hệ thống sử dụng cơ chế bảo vệ Route nghiêm ngặt:
- **ProtectedRoute**: Kiểm tra trạng thái đăng nhập.
- **Permission Guard**: Chỉ hiển thị menu và cho phép truy cập nếu User có `permission_code` tương ứng.

---

## 📄 Giấy phép

Dự án này được phát triển bởi **OWNER**. Tất cả các quyền được bảo lưu.

---

## ✍️ Đóng góp

Mọi đóng góp nhằm cải thiện hệ thống đều được hoan nghênh. Vui lòng tạo Issue hoặc Pull Request nếu bạn có ý tưởng mới.
