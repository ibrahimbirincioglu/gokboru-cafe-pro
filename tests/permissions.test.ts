import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  defaultRouteForRole,
  hasPermission,
  PERMISSIONS,
} from "../src/lib/auth/permissions";

describe("role permission matrix", () => {
  it("gives OWNER every permission", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(UserRole.OWNER, permission)).toBe(true);
    }
  });

  it("allows ADMIN to enter admin, POS and waiter areas", () => {
    expect(
      hasPermission(UserRole.ADMIN, PERMISSIONS.ADMIN_ACCESS),
    ).toBe(true);
    expect(hasPermission(UserRole.ADMIN, PERMISSIONS.POS_ACCESS)).toBe(
      true,
    );
    expect(
      hasPermission(UserRole.ADMIN, PERMISSIONS.WAITER_ACCESS),
    ).toBe(true);
  });

  it("keeps CASHIER out of admin and waiter areas", () => {
    expect(
      hasPermission(UserRole.CASHIER, PERMISSIONS.POS_ACCESS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.CASHIER, PERMISSIONS.ADMIN_ACCESS),
    ).toBe(false);
    expect(
      hasPermission(UserRole.CASHIER, PERMISSIONS.WAITER_ACCESS),
    ).toBe(false);
  });

  it("keeps WAITER out of admin, POS and reports", () => {
    expect(
      hasPermission(UserRole.WAITER, PERMISSIONS.WAITER_ACCESS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.WAITER, PERMISSIONS.ADMIN_ACCESS),
    ).toBe(false);
    expect(
      hasPermission(UserRole.WAITER, PERMISSIONS.POS_ACCESS),
    ).toBe(false);
    expect(
      hasPermission(UserRole.WAITER, PERMISSIONS.REPORTS_VIEW),
    ).toBe(false);
  });

  it("does not enable KITCHEN during this scoped phase", () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(UserRole.KITCHEN, permission)).toBe(false);
    }
  });

  it("uses role-appropriate landing pages", () => {
    expect(defaultRouteForRole(UserRole.OWNER)).toBe("/admin");
    expect(defaultRouteForRole(UserRole.ADMIN)).toBe("/admin");
    expect(defaultRouteForRole(UserRole.CASHIER)).toBe("/pos");
    expect(defaultRouteForRole(UserRole.WAITER)).toBe("/waiter");
  });
});
