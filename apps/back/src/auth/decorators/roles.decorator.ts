import { SetMetadata } from '@nestjs/common';
import { Role } from '../roles';

export const ROLES_KEY = 'telerady:roles';

/**
 * Marks a route as requiring at least one of the given roles.
 *
 * Combine with the global JwtAuthGuard + RolesGuard to enforce.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
