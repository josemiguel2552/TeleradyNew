import { AbilityFactory } from './ability.factory';
import type { AuthenticatedUser } from '../jwt.strategy';
import { Role } from '../roles';

const make = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'u',
  email: 'u@example.com',
  roles: [],
  hospitalIds: [],
  ...overrides,
});

describe('AbilityFactory', () => {
  const factory = new AbilityFactory();

  it('admin can do everything', () => {
    const ability = factory.forUser(make({ roles: [Role.Admin] }));
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'AuditLog')).toBe(true);
  });

  it('hospital user can only read their own tenant studies', () => {
    const ability = factory.forUser(
      make({ roles: [Role.HospitalUser], hospitalId: 'h-1' }),
    );
    expect(ability.can('read', 'Study')).toBe(true);
    expect(ability.cannot('delete', 'Study')).toBe(true);
  });

  it('radiologist can sign reports tied to their professionalId', () => {
    const ability = factory.forUser(
      make({ roles: [Role.Radiologist], professionalId: 'p-1' }),
    );
    expect(ability.can('sign', 'Report')).toBe(true);
    expect(ability.cannot('delete', 'Report')).toBe(true);
  });

  it('user with no role cannot do anything sensitive', () => {
    const ability = factory.forUser(make({ roles: [] }));
    expect(ability.cannot('read', 'Report')).toBe(true);
    expect(ability.cannot('manage', 'all')).toBe(true);
  });
});
