/* eslint-disable @typescript-eslint/no-explicit-any */
const selectMock = jest.fn();
const insertMock = jest.fn();
const updateMock = jest.fn();
const deleteMock = jest.fn();
const executeMock = jest.fn();

jest.mock('../../database/drizzle', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    execute: (...args: unknown[]) => executeMock(...args),
  },
}));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkflowAdminService } from './workflow-admin.service';
import type { AuditLogService } from '../../common/audit/audit-log.service';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';

function chainable<T>(value: T): any {
  const obj: any = {};
  for (const m of ['from', 'where', 'orderBy', 'set', 'values', 'returning', 'limit']) {
    obj[m] = jest.fn().mockReturnValue(obj);
  }
  obj.then = (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve);
  // Final-await: make any pending limit/returning call resolve to `value`
  obj.limit = jest.fn().mockResolvedValue(value);
  obj.returning = jest.fn().mockResolvedValue(value);
  obj.orderBy = jest.fn().mockResolvedValue(value);
  return obj;
}

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'u-1',
    email: 'u@telerady.test',
    roles: ['radiologist'],
    hospitalIds: ['hosp-1'],
    professionalId: 'prof-1',
    ...overrides,
  };
}

function makeService() {
  const audit = { append: jest.fn().mockResolvedValue(undefined) } as unknown as AuditLogService;
  return { service: new WorkflowAdminService(audit), audit };
}

beforeEach(() => {
  selectMock.mockReset();
  insertMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  executeMock.mockReset();
});

describe('WorkflowAdminService.listRules', () => {
  it('returns the rules mapped to DTOs', async () => {
    const row = {
      id: 'r-1',
      hospitalId: 'hosp-1',
      modality: 'CT',
      subspecialtyId: null,
      targetProfessionalId: 'prof-1',
      priority: 10,
      requiresReview: false,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    };
    selectMock.mockReturnValue(chainable([row]));
    const { service } = makeService();
    const out = await service.listRules(makeUser({ roles: ['admin'], hospitalIds: [] }));
    expect(out).toEqual([
      expect.objectContaining({ id: 'r-1', modality: 'CT', targetProfessionalId: 'prof-1' }),
    ]);
  });
});

describe('WorkflowAdminService.createRule', () => {
  it('lets a privileged admin create a global rule (no hospitalId)', async () => {
    const inserted = {
      id: 'r-1',
      hospitalId: null,
      modality: null,
      subspecialtyId: null,
      targetProfessionalId: 'prof-1',
      priority: 50,
      requiresReview: false,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    };
    insertMock.mockReturnValue(chainable([inserted]));
    const { service, audit } = makeService();
    const out = await service.createRule(makeUser({ roles: ['admin'], hospitalIds: [] }), {
      targetProfessionalId: 'prof-1',
      priority: 50,
      requiresReview: false,
      active: true,
    } as any);
    expect(out.id).toBe('r-1');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.rule_created' }),
    );
  });

  it('forbids a non-privileged user from creating a global rule', async () => {
    const { service } = makeService();
    await expect(
      service.createRule(makeUser(), {
        targetProfessionalId: 'prof-1',
        priority: 50,
        requiresReview: false,
        active: true,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('lets a hospital_admin create a rule scoped to their hospital', async () => {
    const inserted = {
      id: 'r-2',
      hospitalId: 'hosp-1',
      modality: 'CT',
      subspecialtyId: null,
      targetProfessionalId: 'prof-1',
      priority: 10,
      requiresReview: false,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    };
    insertMock.mockReturnValue(chainable([inserted]));
    const { service } = makeService();
    const out = await service.createRule(
      makeUser({ roles: ['hospital_admin'], hospitalIds: ['hosp-1'] }),
      { hospitalId: 'hosp-1', targetProfessionalId: 'prof-1', priority: 10, requiresReview: false, active: true, modality: 'CT' } as any,
    );
    expect(out.modality).toBe('CT');
  });
});

describe('WorkflowAdminService.deleteRule', () => {
  it('throws NotFoundException when the rule does not exist', async () => {
    selectMock.mockReturnValue(chainable([]));
    const { service } = makeService();
    await expect(
      service.deleteRule(makeUser({ roles: ['admin'] }), 'r-missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids a non-privileged user from deleting a global rule', async () => {
    selectMock.mockReturnValue(chainable([{ id: 'r-1', hospitalId: null }]));
    const { service } = makeService();
    await expect(service.deleteRule(makeUser(), 'r-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes a hospital-scoped rule and writes an audit row', async () => {
    selectMock.mockReturnValue(chainable([{ id: 'r-1', hospitalId: 'hosp-1' }]));
    deleteMock.mockReturnValue(chainable(undefined));
    const { service, audit } = makeService();
    await service.deleteRule(
      makeUser({ roles: ['hospital_admin'], hospitalIds: ['hosp-1'] }),
      'r-1',
    );
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.rule_deleted', targetId: 'r-1' }),
    );
  });
});

describe('WorkflowAdminService.review', () => {
  function setStudyAndReport(study: unknown, report: unknown) {
    selectMock
      .mockReturnValueOnce(chainable(study === null ? [] : [study]))
      .mockReturnValueOnce(chainable(report === null ? [] : [report]));
  }

  it('refuses a non-professional', async () => {
    const { service } = makeService();
    await expect(
      service.review(makeUser({ professionalId: undefined }), 's-1', { approved: true } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when the study is missing', async () => {
    setStudyAndReport(null, null);
    const { service } = makeService();
    await expect(service.review(makeUser(), 's-1', { approved: true } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s when the report is missing', async () => {
    setStudyAndReport({ id: 's-1', hospitalId: 'hosp-1' }, null);
    const { service } = makeService();
    await expect(service.review(makeUser(), 's-1', { approved: true } as any)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('400s when the report does not require review', async () => {
    setStudyAndReport(
      { id: 's-1', hospitalId: 'hosp-1' },
      { id: 'rep-1', requiresReview: false, state: 'signed', professionalId: 'prof-X', version: 1 },
    );
    const { service } = makeService();
    await expect(service.review(makeUser(), 's-1', { approved: true } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('400s when the report state is not finalized/signed', async () => {
    setStudyAndReport(
      { id: 's-1', hospitalId: 'hosp-1' },
      { id: 'rep-1', requiresReview: true, state: 'draft', professionalId: 'prof-X', version: 1 },
    );
    const { service } = makeService();
    await expect(service.review(makeUser(), 's-1', { approved: true } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('forbids self-review (reviewer == author)', async () => {
    setStudyAndReport(
      { id: 's-1', hospitalId: 'hosp-1' },
      { id: 'rep-1', requiresReview: true, state: 'signed', professionalId: 'prof-1', version: 3 },
    );
    const { service } = makeService();
    await expect(service.review(makeUser(), 's-1', { approved: true } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('approves: state preserved, version preserved, audit approved', async () => {
    setStudyAndReport(
      { id: 's-1', hospitalId: 'hosp-1' },
      { id: 'rep-1', requiresReview: true, state: 'signed', professionalId: 'prof-X', version: 3 },
    );
    updateMock.mockReturnValue(
      chainable([
        {
          id: 'rep-1',
          state: 'signed',
          reviewApproved: true,
          reviewerProfessionalId: 'prof-1',
          reviewedAt: '2026-05-10T10:00:00Z',
        },
      ]),
    );
    const { service, audit } = makeService();
    const out = await service.review(makeUser(), 's-1', { approved: true } as any);
    expect(out.reviewApproved).toBe(true);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.review_approved' }),
    );
  });

  it('rejects: state→draft, version++ via update, audit rejected', async () => {
    setStudyAndReport(
      { id: 's-1', hospitalId: 'hosp-1' },
      { id: 'rep-1', requiresReview: true, state: 'finalized', professionalId: 'prof-X', version: 3 },
    );
    const setSpy = jest.fn().mockReturnThis();
    const whereSpy = jest.fn().mockReturnThis();
    const returningSpy = jest.fn().mockResolvedValue([
      {
        id: 'rep-1',
        state: 'draft',
        reviewApproved: false,
        reviewerProfessionalId: 'prof-1',
        reviewedAt: '2026-05-10T10:00:00Z',
      },
    ]);
    updateMock.mockReturnValue({ set: setSpy, where: whereSpy, returning: returningSpy });
    const { service, audit } = makeService();
    const out = await service.review(makeUser(), 's-1', {
      approved: false,
      comments: 'redo',
    } as any);
    expect(out.state).toBe('draft');
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'draft', version: 4, reviewApproved: false }),
    );
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.review_rejected',
        payload: expect.objectContaining({ comments: 'redo' }),
      }),
    );
  });
});

describe('WorkflowAdminService.escalateBreaches', () => {
  it('forbids non-privileged callers', async () => {
    const { service } = makeService();
    await expect(service.escalateBreaches(makeUser(), 60)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('audits one row per breach and returns the count', async () => {
    executeMock.mockResolvedValue({
      rows: [
        { id: 's-1', hospital_id: 'hosp-1' },
        { id: 's-2', hospital_id: null },
      ],
    });
    const { service, audit } = makeService();
    const out = await service.escalateBreaches(makeUser({ roles: ['admin'] }), 90);
    expect(out).toEqual({ escalated: 2 });
    expect(audit.append).toHaveBeenCalledTimes(2);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'workflow.sla_breach_escalated',
        payload: { thresholdMinutes: 90 },
      }),
    );
  });
});
