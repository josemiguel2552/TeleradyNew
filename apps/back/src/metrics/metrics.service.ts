import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import client, {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Owns the prom-client registry and the set of platform-specific
 * metrics. Other modules read the singletons directly:
 *
 *   metrics.httpRequests.labels(method, route, status).inc();
 *   metrics.reportSigned.inc();
 */
@Injectable()
export class MetricsService implements OnApplicationBootstrap {
  readonly registry: Registry = new client.Registry();

  readonly httpRequests = new Counter({
    name: 'telerady_http_requests_total',
    help: 'HTTP requests handled by the API, labeled by method, route and status',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'telerady_http_request_duration_seconds',
    help: 'End-to-end HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.6, 1, 2, 5, 10],
    registers: [this.registry],
  });

  readonly reportSigned = new Counter({
    name: 'telerady_report_signed_total',
    help: 'Reports successfully signed by a radiologist',
    registers: [this.registry],
  });

  readonly reportSent = new Counter({
    name: 'telerady_report_sent_total',
    help: 'Reports marked as sent to the hospital',
    registers: [this.registry],
  });

  readonly auditAppended = new Counter({
    name: 'telerady_audit_appended_total',
    help: 'Audit log rows appended',
    registers: [this.registry],
  });

  readonly slaPendingGauge = new Gauge({
    name: 'telerady_sla_pending_reports',
    help: 'Reports older than 24 h still without signature',
    registers: [this.registry],
  });

  onApplicationBootstrap(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  scrape(): Promise<string> {
    return this.registry.metrics();
  }
}
