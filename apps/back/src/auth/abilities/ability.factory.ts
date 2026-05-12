import { AbilityBuilder, createMongoAbility, MongoAbility, MongoQuery } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../jwt.strategy';
import { Role } from '../roles';

/**
 * Subjects under access control. Strings instead of classes to keep the
 * surface independent from the data layer (Drizzle types live elsewhere).
 */
export type Subject =
  | 'Report'
  | 'Study'
  | 'Hospital'
  | 'Professional'
  | 'AuditLog'
  | 'all';

export type Action = 'manage' | 'read' | 'create' | 'update' | 'delete' | 'sign';

export type AppAbility = MongoAbility<[Action, Subject]>;

@Injectable()
export class AbilityFactory {
  forUser(user: AuthenticatedUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const tenant: MongoQuery = user.hospitalId ? { hospitalId: user.hospitalId } : {};

    if (user.roles.includes(Role.Admin)) {
      can('manage', 'all');
    }

    if (user.roles.includes(Role.Coordinator)) {
      can('manage', 'Report');
      can('manage', 'Study');
      can('read', 'Professional');
      can('read', 'AuditLog');
    }

    if (user.roles.includes(Role.HospitalAdmin)) {
      can('manage', 'Hospital', tenant);
      can('manage', 'Study', tenant);
      can('read', 'Report', tenant);
    }

    if (user.roles.includes(Role.HospitalUser)) {
      can('read', 'Study', tenant);
      can('create', 'Study', tenant);
      can('read', 'Report', tenant);
    }

    if (user.roles.includes(Role.Radiologist) && user.professionalId) {
      can('read', 'Study', { professionalId: user.professionalId });
      can('update', 'Report', { professionalId: user.professionalId });
      can('sign', 'Report', { professionalId: user.professionalId });
    }

    return build();
  }
}
