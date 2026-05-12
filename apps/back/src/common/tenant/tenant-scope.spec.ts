import { ForbiddenException } from '@nestjs/common';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { Role } from '../../auth/roles';
import { TenantScope } from './tenant-scope';

const fakeColumn = { name: 'hospital_id' } as unknown as AnyPgColumn;

const user = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'u',
  email: 'u@example.com',
  roles: [],
  hospitalIds: [],
  ...overrides,
});

describe('TenantScope', () => {
  it('admins are privileged: no filter applied', () => {
    const scope = TenantScope.for(user({ roles: [Role.Admin] }));
    expect(scope.isPrivileged).toBe(true);
    expect(scope.whereHospital(fakeColumn)).toBeUndefined();
  });

  it('coordinators are privileged', () => {
    const scope = TenantScope.for(user({ roles: [Role.Coordinator] }));
    expect(scope.isPrivileged).toBe(true);
  });

  it('rejects users with no hospital membership and no privilege', () => {
    const scope = TenantScope.for(user({ roles: [Role.HospitalUser] }));
    expect(() => scope.whereHospital(fakeColumn)).toThrow(ForbiddenException);
  });

  it('produces a single-hospital filter', () => {
    const scope = TenantScope.for(
      user({ roles: [Role.HospitalUser], hospitalIds: ['h-1'] }),
    );
    const sql = scope.whereHospital(fakeColumn);
    expect(sql).toBeDefined();
  });

  it('produces a multi-hospital OR filter', () => {
    const scope = TenantScope.for(
      user({ roles: [Role.HospitalUser], hospitalIds: ['h-1', 'h-2'] }),
    );
    const sql = scope.whereHospital(fakeColumn);
    expect(sql).toBeDefined();
  });

  it('assertCanAct allows the user to act on their own hospital', () => {
    const scope = TenantScope.for(
      user({ roles: [Role.HospitalUser], hospitalIds: ['h-1'] }),
    );
    expect(() => scope.assertCanAct('h-1')).not.toThrow();
    expect(() => scope.assertCanAct('h-2')).toThrow(ForbiddenException);
  });

  it('assertCanAct never blocks privileged users', () => {
    const scope = TenantScope.for(user({ roles: [Role.Admin] }));
    expect(() => scope.assertCanAct('any-hospital')).not.toThrow();
  });
});
