import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
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

export type AppAbility = MongoAbility<[Action, Subject], MongoQuery>;

@Injectable()
export class AbilityFactory {
  forUser(user: AuthenticatedUser): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    // CASL `MongoQuery<never>` cannot be satisfied with our open-ended
    // condition objects, so we narrow the helper signature at the
    // factory boundary. The actual runtime check is unaffected.
    const can = builder.can as (
      action: Action | Action[],
      subject: Subject | Subject[],
      conditions?: Record<string, unknown>,
    ) => unknown;

    const tenant = user.hospitalId ? { hospitalId: user.hospitalId } : {};

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
      const own = { professionalId: user.professionalId };
      can('read', 'Study', own);
      can('update', 'Report', own);
      can('sign', 'Report', own);
    }

    return builder.build();
  }
}
