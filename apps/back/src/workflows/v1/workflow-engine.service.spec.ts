import type { DBOrTx } from '../../database/drizzle';
import { WorkflowEngine } from './workflow-engine.service';

/**
 * Build a fake db whose `.select().from().where().orderBy()` resolves
 * to `rows`. The engine only does one read per call, so this is
 * enough to exercise the decision logic without mocking drizzle's
 * full surface.
 */
function dbWith(rows: unknown[]): DBOrTx {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(rows),
        }),
      }),
    }),
  } as unknown as DBOrTx;
}

describe('WorkflowEngine.decide', () => {
  const engine = new WorkflowEngine();

  it('returns null when no rules exist', async () => {
    const out = await engine.decide(dbWith([]), {
      hospitalId: 'h-1',
      modalities: ['CT'],
      subspecialtyId: null,
    });
    expect(out).toEqual({ professionalId: null, requiresReview: false, matchedRuleId: null });
  });

  it('returns the first matching rule by priority order', async () => {
    // Both rules match; the lower-priority one wins (planner already
    // sorted by priority asc).
    const db = dbWith([
      { id: 'r-1', priority: 1, hospitalId: 'h-1', modality: null, subspecialtyId: null,
        targetProfessionalId: 'prof-1', requiresReview: false },
      { id: 'r-2', priority: 2, hospitalId: 'h-1', modality: null, subspecialtyId: null,
        targetProfessionalId: 'prof-2', requiresReview: true },
    ]);
    const out = await engine.decide(db, { hospitalId: 'h-1', modalities: ['CT'], subspecialtyId: null });
    expect(out.professionalId).toBe('prof-1');
    expect(out.matchedRuleId).toBe('r-1');
  });

  it('skips a rule whose modality does not match the study', async () => {
    const db = dbWith([
      { id: 'r-1', priority: 1, hospitalId: 'h-1', modality: 'MR', subspecialtyId: null,
        targetProfessionalId: 'prof-mr', requiresReview: false },
      { id: 'r-2', priority: 2, hospitalId: 'h-1', modality: 'CT', subspecialtyId: null,
        targetProfessionalId: 'prof-ct', requiresReview: false },
    ]);
    const out = await engine.decide(db, {
      hospitalId: 'h-1',
      modalities: ['CT'],
      subspecialtyId: null,
    });
    expect(out.professionalId).toBe('prof-ct');
    expect(out.matchedRuleId).toBe('r-2');
  });

  it('respects the subspecialty filter — only matches when ids align', async () => {
    const db = dbWith([
      { id: 'r-1', priority: 1, hospitalId: null, modality: 'CT', subspecialtyId: 5,
        targetProfessionalId: 'prof-neuro', requiresReview: false },
      { id: 'r-2', priority: 2, hospitalId: null, modality: null, subspecialtyId: null,
        targetProfessionalId: 'prof-any', requiresReview: false },
    ]);
    const sub5 = await engine.decide(db, { hospitalId: null, modalities: ['CT'], subspecialtyId: 5 });
    expect(sub5.matchedRuleId).toBe('r-1');
    const subWrong = await engine.decide(db, { hospitalId: null, modalities: ['CT'], subspecialtyId: 7 });
    expect(subWrong.matchedRuleId).toBe('r-2');
  });

  it('skips rules with no target professional', async () => {
    const db = dbWith([
      { id: 'r-1', priority: 1, hospitalId: 'h-1', modality: null, subspecialtyId: null,
        targetProfessionalId: null, requiresReview: false },
      { id: 'r-2', priority: 2, hospitalId: 'h-1', modality: null, subspecialtyId: null,
        targetProfessionalId: 'prof-fallback', requiresReview: false },
    ]);
    const out = await engine.decide(db, { hospitalId: 'h-1', modalities: ['CT'], subspecialtyId: null });
    expect(out.professionalId).toBe('prof-fallback');
  });

  it('surfaces requiresReview when the matching rule asks for review', async () => {
    const db = dbWith([
      { id: 'r-1', priority: 1, hospitalId: 'h-1', modality: null, subspecialtyId: null,
        targetProfessionalId: 'prof-1', requiresReview: true },
    ]);
    const out = await engine.decide(db, { hospitalId: 'h-1', modalities: ['CT'], subspecialtyId: null });
    expect(out.requiresReview).toBe(true);
  });
});

describe('WorkflowEngine.applyToStudy', () => {
  it('updates the report_study row when a rule matched', async () => {
    const updateSet = jest.fn().mockReturnThis();
    const updateWhere = jest.fn().mockResolvedValue(undefined);
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              { id: 'r-1', priority: 1, hospitalId: 'h-1', modality: null,
                subspecialtyId: null, targetProfessionalId: 'prof-1', requiresReview: false },
            ]),
          }),
        }),
      }),
      update: () => ({
        set: updateSet,
        where: updateWhere,
      }),
    } as unknown as DBOrTx;
    // Wire set → where chain.
    updateSet.mockReturnValueOnce({ where: updateWhere });

    const engine = new WorkflowEngine();
    const out = await engine.applyToStudy(db, 'rs-1', {
      hospitalId: 'h-1',
      modalities: ['CT'],
      subspecialtyId: null,
    });
    expect(out.professionalId).toBe('prof-1');
    expect(updateSet).toHaveBeenCalledWith({ professionalId: 'prof-1' });
    expect(updateWhere).toHaveBeenCalled();
  });

  it('does not touch the study when no rule matched', async () => {
    const updateFn = jest.fn();
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
      update: updateFn,
    } as unknown as DBOrTx;

    const engine = new WorkflowEngine();
    const out = await engine.applyToStudy(db, 'rs-2', {
      hospitalId: null,
      modalities: ['CT'],
      subspecialtyId: null,
    });
    expect(out.professionalId).toBeNull();
    expect(updateFn).not.toHaveBeenCalled();
  });
});
