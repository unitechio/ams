// import type { Role, User, MenuItem, Permission, PermissionDetail } from "@/types";

// // ─── Mock Roles ───────────────────────────────────────────────────────────────
// export const mockRoles: Role[] = [
//   { id: 1, name: "Super Admin", description: "Toàn quyền hệ thống", createdAt: "2024-01-01", updatedAt: "2024-03-15", userCount: 2, status: "active" },
//   { id: 2, name: "Admin", description: "Quản trị viên", createdAt: "2024-01-05", updatedAt: "2024-03-10", userCount: 5, status: "active" },
//   { id: 3, name: "Manager", description: "Quản lý", createdAt: "2024-01-10", updatedAt: "2024-02-20", userCount: 12, status: "active" },
//   { id: 4, name: "Operator", description: "Vận hành viên", createdAt: "2024-01-15", updatedAt: "2024-02-18", userCount: 30, status: "active" },
//   { id: 5, name: "Viewer", description: "Chỉ xem", createdAt: "2024-02-01", updatedAt: "2024-02-01", userCount: 8, status: "inactive" },
// ];

// // ─── Mock Users ───────────────────────────────────────────────────────────────
// export const mockUsers: User[] = [
//   { id: 1, username: "superadmin", fullName: "Nguyễn Văn A", email: "superadmin@system.vn", phone: "0912345678", roleId: 1, roleName: "Super Admin", status: "active", createdAt: "2024-01-01", lastLogin: "2024-03-20 09:15" },
//   { id: 2, username: "admin01", fullName: "Trần Thị B", email: "admin01@system.vn", phone: "0923456789", roleId: 2, roleName: "Admin", status: "active", createdAt: "2024-01-05", lastLogin: "2024-03-19 14:30" },
//   { id: 3, username: "manager01", fullName: "Lê Văn C", email: "manager01@system.vn", phone: "0934567890", roleId: 3, roleName: "Manager", status: "active", createdAt: "2024-01-10", lastLogin: "2024-03-18 08:00" },
//   { id: 4, username: "operator01", fullName: "Phạm Thị D", email: "operator01@system.vn", phone: "0945678901", roleId: 4, roleName: "Operator", status: "active", createdAt: "2024-02-01", lastLogin: "2024-03-20 07:45" },
//   { id: 5, username: "operator02", fullName: "Hoàng Văn E", email: "operator02@system.vn", roleId: 4, roleName: "Operator", status: "locked", createdAt: "2024-02-10", lastLogin: "2024-03-01 10:00" },
//   { id: 6, username: "viewer01", fullName: "Ngô Thị F", email: "viewer01@system.vn", roleId: 5, roleName: "Viewer", status: "inactive", createdAt: "2024-02-15" },
//   { id: 7, username: "manager02", fullName: "Bùi Văn G", email: "manager02@system.vn", phone: "0956789012", roleId: 3, roleName: "Manager", status: "active", createdAt: "2024-02-20", lastLogin: "2024-03-17 16:20" },
//   { id: 8, username: "admin02", fullName: "Đinh Thị H", email: "admin02@system.vn", phone: "0967890123", roleId: 2, roleName: "Admin", status: "active", createdAt: "2024-03-01", lastLogin: "2024-03-20 11:00" },
// ];

// // ─── Mock Menu Items ──────────────────────────────────────────────────────────
// export const mockMenuItems: MenuItem[] = [
//   { id: 1, title: "Trang chủ", url: "/", order: 9999, icon: "bi bi-grid", level: 1 },
//   { id: 2, title: "Quản lý khách sạn", url: "#", order: 1000, icon: "bx bxs-bus", level: 1 },
//   { id: 3, title: "--- Quản lý phòng", url: "/hotel/QuanLyPhong/Index", parentId: 2, parentTitle: "Quản lý khách sạn", order: 100, icon: "bx bx-hotel", level: 2 },
//   { id: 4, title: "--- Quản lý đặt phòng", url: "/hotel/QuanLyDatPhong/ThinhTrang", parentId: 2, parentTitle: "Quản lý khách sạn", order: 90, icon: "bx bx-calendar", level: 2 },
//   { id: 5, title: "Lễ tân", url: "#", order: 999, icon: "bx bx-user", level: 1 },
//   { id: 6, title: "--- Booking tại quầy", url: "/hotel/LeTan/DatTaiQuay", parentId: 5, parentTitle: "Lễ tân", order: 100, icon: "bx bx-barcode", level: 2 },
//   { id: 7, title: "Quản lý bài viết", url: "#", order: 900, icon: "bx bx-book", level: 1 },
//   { id: 8, title: "--- Danh mục bài viết", url: "/Site/Categories/Index?Type=1", parentId: 7, parentTitle: "Quản lý bài viết", order: 100, icon: "bx bx-category", level: 2 },
//   { id: 9, title: "--- Danh sách bài viết", url: "/Site/Article/Index?Type=1", parentId: 7, parentTitle: "Quản lý bài viết", order: 90, icon: "bx bx-news", level: 2 },
//   { id: 10, title: "Quản lý sản phẩm", url: "#", order: 880, icon: "bx bx-category", level: 1 },
//   { id: 11, title: "--- Thêm sản phẩm mới", url: "/Site/ProductCreate/Update", parentId: 10, parentTitle: "Quản lý sản phẩm", order: 200, icon: "bx bx-plus", level: 2 },
//   { id: 12, title: "Cấu hình website", url: "#", order: 800, icon: "bx bx-cog", level: 1 },
//   { id: 13, title: "--- Cấu hình menu ngang", url: "/Site/Config/MenuNgang", parentId: 12, parentTitle: "Cấu hình website", order: 100, icon: "bx bx-menu", level: 2 },
// ];

// // ─── Mock Permissions ─────────────────────────────────────────────────────────
// export const mockPermissions: Permission[] = [
//   { id: 1, name: "Quản lý phòng - Xem danh sách", description: "Quản lý phòng - Xem danh sách phòng", menuId: 3, menuTitle: "--- Quản lý phòng", status: "active" },
//   { id: 2, name: "Quản lý phòng - Thêm phòng", description: "Quản lý phòng - Thêm phòng mới", menuId: 3, menuTitle: "--- Quản lý phòng", status: "active" },
//   { id: 3, name: "Quản lý đặt phòng", description: "Quản lý đặt phòng - Toàn bộ", menuId: 4, menuTitle: "--- Quản lý đặt phòng", status: "active" },
//   { id: 4, name: "Lễ tân - Booking tại quầy", description: "Lễ tân - Booking tại quầy", menuId: 6, menuTitle: "--- Booking tại quầy", status: "active" },
//   { id: 5, name: "Quản lý sản phẩm - Danh mục sản phẩm", description: "Quản lý sản phẩm - Danh mục sản phẩm", menuId: 10, menuTitle: "Quản lý sản phẩm", status: "active" },
//   { id: 6, name: "Quản lý sản phẩm - Toàn bộ sản phẩm", description: "Quản lý sản phẩm - Toàn bộ sản phẩm", menuId: 10, menuTitle: "Quản lý sản phẩm", status: "active" },
//   { id: 7, name: "Quản lý sản phẩm - Thêm sản phẩm", description: "Quản lý sản phẩm - Thêm sản phẩm mới", menuId: 11, menuTitle: "--- Thêm sản phẩm mới", status: "active" },
//   { id: 8, name: "Dữ liệu website - Danh sách đơn hàng", description: "Dữ liệu website - Danh sách đơn hàng", menuId: 12, menuTitle: "Cấu hình website", status: "active" },
//   { id: 9, name: "Cấu hình website - Cấu hình menu ngang", description: "Cấu hình website - Cấu hình menu ngang", menuId: 13, menuTitle: "--- Cấu hình menu ngang", status: "active" },
//   { id: 10, name: "Cấu hình website - Cấu hình slider trang chủ", description: "Cấu hình website - Cấu hình slider trang chủ", menuId: 12, menuTitle: "Cấu hình website", status: "active" },
//   { id: 11, name: "Quản lý bài viết - Thêm mới bài viết", description: "Quản lý bài viết - Thêm mới bài viết", menuId: 7, menuTitle: "Quản lý bài viết", status: "active" },
// ];

// // ─── Mock Permission Details ──────────────────────────────────────────────────
// export const mockPermissionDetails: PermissionDetail[] = [
//   { id: 1, controller: "SiteMenu", action: "Index", description: "Cấu hình menu ngang", permissionId: 9 },
//   { id: 2, controller: "SiteMenu", action: "Create", description: "Thêm mới menu", permissionId: 9 },
//   { id: 3, controller: "SiteMenu", action: "Edit", description: "Chỉnh sửa menu", permissionId: 9 },
//   { id: 4, controller: "Room", action: "Index", description: "Xem danh sách phòng", permissionId: 1 },
//   { id: 5, controller: "Room", action: "Create", description: "Thêm phòng mới", permissionId: 2 },
//   { id: 6, controller: "Booking", action: "Index", description: "Danh sách đặt phòng", permissionId: 3 },
//   { id: 7, controller: "Product", action: "Index", description: "Danh sách sản phẩm", permissionId: 5 },
//   { id: 8, controller: "Product", action: "Create", description: "Thêm sản phẩm mới", permissionId: 7 },
// ];
