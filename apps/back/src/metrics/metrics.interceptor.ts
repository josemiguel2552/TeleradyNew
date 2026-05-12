import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Records counter + histogram for every HTTP request. Uses the route
 * template (e.g. `/v1/worklist/:id`) instead of the resolved URL so
 * cardinality stays bounded.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; route?: { path?: string }; originalUrl?: string }>();
    const res = http.getResponse<{ statusCode: number }>();
    const start = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.record(req, res, start),
        error: () => this.record(req, res, start, 500),
      }),
    );
  }

  private record(
    req: { method: string; route?: { path?: string }; originalUrl?: string },
    res: { statusCode: number },
    start: bigint,
    forcedStatus?: number,
  ): void {
    const route = req.route?.path ?? req.originalUrl ?? 'unknown';
    const status = String(forcedStatus ?? res.statusCode ?? 0);
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000_000;
    this.metrics.httpRequests.labels(req.method, route, status).inc();
    this.metrics.httpDuration.labels(req.method, route, status).observe(duration);
  }
}
