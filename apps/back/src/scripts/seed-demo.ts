/* eslint-disable no-console */
/**
 * Demo seed.
 *
 * Wipes the demo entities (idempotent) and recreates:
 *   - 1 hospital
 *   - 1 radiologist professional + 1 admin user + 1 hospital_admin
 *   - 1 assignment rule (CT -> the demo radiologist)
 *   - 3 sample report_study rows (encrypted patient fields)
 *   - 1 mwl_entry scheduled for tomorrow
 *
 * Default credentials:
 *   admin@telerady.test          / AdminDemo!2026
 *   pepa@telerady.test (radio)   / RadDemo!2026
 *   hospital@telerady.test       / HospitalDemo!2026
 *
 * Usage:
 *   npm run seed:demo
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { createHmac, createCipheriv, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import {
  appUserInTelerady,
  assignmentRuleInTelerady,
  hospitalInTelerady,
  hospitalMembershipInTelerady,
  mwlEntryInTelerady,
  professionalInTelerady,
  reportStudyInTelerady,
  userRoleAssignmentInTelerady,
} from '../database/schema';

const HOSPITAL_TAX_ID = 'DEMO-A12345678';
const RADIO_EMAIL = 'pepa@telerady.test';
const ADMIN_EMAIL = 'admin@telerady.test';
const HOSPITAL_USER_EMAIL = 'hospital@telerady.test';

function packGcm(plaintext: string, masterKeyHex: string, aad: string): string {
  const key = Buffer.from(masterKeyHex, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function hmacHash(value: string, pepperHex: string): string {
  return createHmac('sha256', Buffer.from(pepperHex, 'hex')).update(value, 'utf8').digest('hex');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  const pepper = process.env.PSEUDONYM_PEPPER;
  if (!dbUrl || !masterKey || !pepper) {
    console.error(
      'Missing one of DATABASE_URL / ENCRYPTION_MASTER_KEY / PSEUDONYM_PEPPER. Run from apps/back with a .env file.',
    );
    process.exit(1);
  }
  const db = drizzle(dbUrl);

  // Apply idempotent DDL migrations that were added after the initial
  // db-seed.sql snapshot. If the postgres container was first booted
  // against an older db-seed.sql, or the init script aborted partway,
  // these statements close the gap so the rest of the seeder can rely
  // on the latest schema. All statements are ADD/CREATE IF NOT EXISTS,
  // so re-running is a no-op on an already up-to-date database.
  console.log('Applying idempotent schema migrations…');
  await db.execute(sql`
    ALTER TABLE telerady.mwl_entry
      ADD COLUMN IF NOT EXISTS priority VARCHAR(16);
    ALTER TABLE telerady.report_study
      ADD COLUMN IF NOT EXISTS accession_number VARCHAR(64),
      ADD COLUMN IF NOT EXISTS priority VARCHAR(16);
    CREATE INDEX IF NOT EXISTS report_study_accession_idx
      ON telerady.report_study (accession_number);
  `);

  console.log('Seeding demo data…');

  // --- Hospital ---
  let hospital = await db
    .select()
    .from(hospitalInTelerady)
    .where(eq(hospitalInTelerady.taxId, HOSPITAL_TAX_ID))
    .limit(1);
  let hospitalId: string;
  if (hospital.length) {
    hospitalId = hospital[0].id;
    console.log(`  hospital exists -> ${hospitalId}`);
  } else {
    const [row] = await db
      .insert(hospitalInTelerady)
      .values({
        name: 'Hospital Demo Telerady',
        taxId: HOSPITAL_TAX_ID,
        signaturePolicy: 'name_collegiate',
        retentionDays: 3650,
        active: true,
      })
      .returning({ id: hospitalInTelerady.id });
    hospitalId = row.id;
    console.log(`  hospital created -> ${hospitalId}`);
  }

  // --- Professional (radiologist) ---
  let professional = await db
    .select()
    .from(professionalInTelerady)
    .where(eq(professionalInTelerady.email, RADIO_EMAIL))
    .limit(1);
  let professionalId: string;
  if (professional.length) {
    professionalId = professional[0].id;
    console.log(`  professional exists -> ${professionalId}`);
  } else {
    const [row] = await db
      .insert(professionalInTelerady)
      .values({
        name: 'Pepa',
        lastName: 'Ramírez',
        email: RADIO_EMAIL,
        cityResidence: 'Madrid',
        phone: '+34 600 000 000',
        professionalLicense: '12345',
      })
      .returning({ id: professionalInTelerady.id });
    professionalId = row.id;
    console.log(`  professional created -> ${professionalId}`);
  }

  // --- Users ---
  async function upsertUser(email: string, password: string, professionalLink: string | null) {
    const existing = await db
      .select()
      .from(appUserInTelerady)
      .where(eq(appUserInTelerady.email, email))
      .limit(1);
    if (existing.length) return existing[0].id;
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 64 * 1024,
      timeCost: 3,
      parallelism: 4,
    });
    const [row] = await db
      .insert(appUserInTelerady)
      .values({ email, passwordHash: hash, professionalId: professionalLink })
      .returning({ id: appUserInTelerady.id });
    return row.id;
  }

  const adminUserId = await upsertUser(ADMIN_EMAIL, 'AdminDemo!2026', null);
  const radioUserId = await upsertUser(RADIO_EMAIL, 'RadDemo!2026', professionalId);
  const hospitalUserId = await upsertUser(HOSPITAL_USER_EMAIL, 'HospitalDemo!2026', null);

  await db
    .insert(userRoleAssignmentInTelerady)
    .values({ userId: adminUserId, role: 'admin' })
    .onConflictDoNothing();
  await db
    .insert(userRoleAssignmentInTelerady)
    .values({ userId: radioUserId, role: 'radiologist' })
    .onConflictDoNothing();
  await db
    .insert(userRoleAssignmentInTelerady)
    .values({ userId: hospitalUserId, role: 'hospital_admin' })
    .onConflictDoNothing();

  await db
    .insert(hospitalMembershipInTelerady)
    .values({ userId: radioUserId, hospitalId, isAdmin: false })
    .onConflictDoNothing();
  await db
    .insert(hospitalMembershipInTelerady)
    .values({ userId: hospitalUserId, hospitalId, isAdmin: true })
    .onConflictDoNothing();

  console.log(`  users ensured: admin / radiologist / hospital_admin`);

  // --- Assignment rule: every CT in this hospital -> Pepa ---
  await db
    .insert(assignmentRuleInTelerady)
    .values({
      hospitalId,
      modality: 'CT',
      targetProfessionalId: professionalId,
      priority: 10,
      requiresReview: false,
      active: true,
    })
    .onConflictDoNothing();

  // --- Sample studies ---
  const samples = [
    {
      iuid: '1.2.3.4.5.demo.001',
      desc: 'TC cerebro sin contraste',
      patId: 'DEMO-PAT-001',
      patName: 'María García',
      sex: 'F',
      birth: '1985-04-23',
      modalities: ['CT'],
      institution: 'Hospital Demo Telerady',
    },
    {
      iuid: '1.2.3.4.5.demo.002',
      desc: 'TC tórax con contraste',
      patId: 'DEMO-PAT-002',
      patName: 'Juan Pérez',
      sex: 'M',
      birth: '1970-11-02',
      modalities: ['CT'],
      institution: 'Hospital Demo Telerady',
    },
    {
      iuid: '1.2.3.4.5.demo.003',
      desc: 'RX tórax PA y lateral',
      patId: 'DEMO-PAT-003',
      patName: 'Ana López',
      sex: 'F',
      birth: '1992-07-14',
      modalities: ['CR'],
      institution: 'Hospital Demo Telerady',
    },
  ];

  for (const s of samples) {
    const existing = await db
      .select({ id: reportStudyInTelerady.id })
      .from(reportStudyInTelerady)
      .where(eq(reportStudyInTelerady.studyIuid, s.iuid))
      .limit(1);
    if (existing.length) continue;
    const aad = `report_study:${professionalId}`;
    const patIdHash = hmacHash(s.patId, pepper);
    const patIdEnc = packGcm(s.patId, masterKey, aad);
    const patNameEnc = packGcm(s.patName, masterKey, aad);
    const patBirthdateEnc = packGcm(s.birth, masterKey, aad);
    await db.insert(reportStudyInTelerady).values({
      hospitalId,
      professionalId,
      studyIuid: s.iuid,
      studyDesc: s.desc,
      sex: s.sex,
      institution: s.institution,
      src: 'seed',
      modalities: s.modalities,
      patId: null,
      patName: null,
      patBirthdate: null,
      patIdEnc,
      patIdHash,
      patNameEnc,
      patBirthdateEnc,
      studyCreatedTime: new Date(Date.now() - 1000 * 60 * 60 * (samples.indexOf(s) + 1) * 6).toISOString(),
      reportStateId: 1,
    });
  }
  console.log(`  ${samples.length} sample studies ensured`);

  // --- One MWL entry scheduled for tomorrow ---
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const yyyy = tomorrow.getFullYear().toString();
  const mm = `${tomorrow.getMonth() + 1}`.padStart(2, '0');
  const dd = `${tomorrow.getDate()}`.padStart(2, '0');
  const mwlExists = await db
    .select({ id: mwlEntryInTelerady.id })
    .from(mwlEntryInTelerady)
    .where(eq(mwlEntryInTelerady.accessionNumber, 'DEMO-ACC-001'))
    .limit(1);
  if (!mwlExists.length) {
    const aad = `mwl:DEMO-ACC-001`;
    await db.insert(mwlEntryInTelerady).values({
      hospitalId,
      accessionNumber: 'DEMO-ACC-001',
      patientIdEnc: packGcm('DEMO-PAT-004', masterKey, aad),
      patientIdHash: hmacHash('DEMO-PAT-004', pepper),
      patientNameEnc: packGcm('Laura Sánchez', masterKey, aad),
      patientBirthdateEnc: packGcm('1978-02-09', masterKey, aad),
      patientSex: 'F',
      studyDescription: 'TC abdomen con contraste',
      scheduledDate: `${yyyy}${mm}${dd}`,
      scheduledTime: '093000',
      modality: 'CT',
      requestingPhysician: 'Dr. Méndez',
      scheduledStationAet: 'CT01',
    });
    console.log('  1 MWL entry scheduled for tomorrow');
  }

  console.log('\nDemo seed complete. Credentials:');
  console.log('  admin@telerady.test     /  AdminDemo!2026');
  console.log('  pepa@telerady.test      /  RadDemo!2026   (radiologist)');
  console.log('  hospital@telerady.test  /  HospitalDemo!2026');
  console.log(`\nHospital id: ${hospitalId}`);
  console.log(`Professional id: ${professionalId}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('seed:demo failed:', err);
  process.exit(1);
});
