import { UserRole } from "@prisma/client";

export const PERMISSIONS = {
  ADMIN_ACCESS: "admin:access",
  POS_ACCESS: "pos:access",
  WAITER_ACCESS: "waiter:access",
  USERS_MANAGE: "users:manage",
  MENU_MANAGE: "menu:manage",
  TABLES_MANAGE: "tables:manage",
  ORDERS_MANAGE: "orders:manage",
  PAYMENTS_TAKE: "payments:take",
  ORDERS_ADJUST: "orders:adjust",
  REPORTS_VIEW: "reports:view",
  SERVICE_REQUESTS_MANAGE: "service-requests:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.OWNER]: ALL_PERMISSIONS,
  [UserRole.ADMIN]: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.WAITER_ACCESS,
    PERMISSIONS.MENU_MANAGE,
    PERMISSIONS.TABLES_MANAGE,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.PAYMENTS_TAKE,
    PERMISSIONS.ORDERS_ADJUST,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SERVICE_REQUESTS_MANAGE,
  ],
  [UserRole.CASHIER]: [
    PERMISSIONS.POS_ACCESS,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.PAYMENTS_TAKE,
  ],
  [UserRole.KITCHEN]: [],
  [UserRole.WAITER]: [
    PERMISSIONS.WAITER_ACCESS,
    PERMISSIONS.ORDERS_MANAGE,
    PERMISSIONS.SERVICE_REQUESTS_MANAGE,
  ],
};

export function hasPermission(role: UserRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function defaultRouteForRole(role: UserRole) {
  switch (role) {
    case UserRole.OWNER:
    case UserRole.ADMIN:
      return "/admin";
    case UserRole.CASHIER:
      return "/pos";
    case UserRole.WAITER:
      return "/waiter";
    case UserRole.KITCHEN:
      return "/admin/login";
  }
}
