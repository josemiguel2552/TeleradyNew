import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { from, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { db } from '../../database/drizzle';
import { Role } from '../../auth/roles';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

const PRIVILEGED_ROLES: ReadonlyArray<string> = [Role.Admin, Role.Coordinator];

/**
 * Pushes the tenant context for the current request into the PostgreSQL
 * session as local GUCs so Row Level Security policies can read it.
 *
 * NOT registered globally. Activate it once the deploy is running under
 * `telerady_app` (BYPASSRLS off) and the migration in
 * `infra/migrations/001-enable-rls.sql` has been applied:
 *
 *   providers: [
 *     { provide: APP_INTERCEPTOR, useClass: RlsContextInterceptor },
 *   ]
 *
 * Each request runs the GUC setup inside a single transaction so the
 * `SET LOCAL` semantics actually stick (set_config('...', '...', true)
 * is scoped to the current transaction). Repositories that already use
 * `db.transaction` are unaffected — this interceptor opens an outer one
 * and the inner transactions become savepoints.
 */
@Injectable()
export class RlsContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsContextInterceptor.name);
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('RLS_ENABLED') === 'true';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.enabled) return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) return next.handle();

    const isPrivileged = user.roles.some((r) => PRIVILEGED_ROLES.includes(r));
    const hospitalsLiteral = `{${user.hospitalIds.join(',')}}`;

    return from(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT
            set_config('app.current_user_id', ${user.id}, true),
            set_config('app.current_professional_id', ${user.professionalId ?? ''}, true),
            set_config('app.current_hospital_ids', ${hospitalsLiteral}, true),
            set_config('app.is_privileged', ${isPrivileged ? 'true' : 'false'}, true)
          `,
        );
      }),
    ).pipe(switchMap(() => next.handle()));
  }
}
