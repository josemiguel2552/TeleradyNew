import { ForbiddenException } from '@nestjs/common';
import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { Role } from '../../auth/roles';

/**
 * Helpers for enforcing tenant isolation in repositories.
 *
 * Two invariants every query against a hospital-scoped table must hold:
 *   1. Always reject the request if the user has no hospital in scope AND
 *      lacks a privileged role (admin/coordinator), even when no rows would
 *      have matched anyway.
 *   2. Always AND the user's hospital_ids into the WHERE clause unless the
 *      user is an admin or coordinator (who can see everything).
 *
 * Wrapping every query helps make this mechanical and reviewable. RLS in
 * Postgres provides a second layer of defence (Sprint 1 final commit).
 */

const PRIVILEGED_ROLES: ReadonlyArray<string> = [Role.Admin, Role.Coordinator];

export class TenantScope {
  private constructor(private readonly user: AuthenticatedUser) {}

  static for(user: AuthenticatedUser): TenantScope {
    return new TenantScope(user);
  }

  get isPrivileged(): boolean {
    return this.user.roles.some((role) => PRIVILEGED_ROLES.includes(role));
  }

  get hospitals(): readonly string[] {
    return this.user.hospitalIds;
  }

  /**
   * Returns a Drizzle SQL fragment that scopes the given column to the user's
   * hospital ids, or `undefined` if the user is privileged (no filter needed).
   *
   * Throws ForbiddenException when the user has neither privilege nor a
   * hospital membership — they have no business touching this query.
   */
  whereHospital(column: AnyPgColumn): SQL | undefined {
    if (this.isPrivileged) return undefined;
    if (this.hospitals.length === 0) {
      throw new ForbiddenException('Tenant scope: user has no hospital membership');
    }
    if (this.hospitals.length === 1) {
      return eq(column, this.hospitals[0]);
    }
    // Drizzle's inArray works fine here, but eq + or keeps this helper
    // dependency-free of the operator import for the test surface.
    const ors = this.hospitals.map((id) => eq(column, id));
    // Lazy import to avoid pulling `or` when not used.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { or } = require('drizzle-orm') as typeof import('drizzle-orm');
    return or(...ors);
  }

  /**
   * Combines the tenant filter with an existing condition. If the user is
   * privileged or the column is already enforced elsewhere, returns the
   * original condition.
   */
  withTenant(column: AnyPgColumn, condition?: SQL): SQL | undefined {
    const tenant = this.whereHospital(column);
    if (!tenant) return condition;
    return condition ? and(tenant, condition) : tenant;
  }

  /**
   * Throws if `hospitalId` is not visible to the user (and they're not
   * privileged). Used before writes that name a tenant explicitly.
   */
  assertCanAct(hospitalId: string): void {
    if (this.isPrivileged) return;
    if (!this.hospitals.includes(hospitalId)) {
      throw new ForbiddenException('Tenant scope: cross-tenant access denied');
    }
  }
}
