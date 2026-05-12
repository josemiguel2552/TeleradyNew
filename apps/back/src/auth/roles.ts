/**
 * Effective roles in Telerady. Stored as strings inside the JWT claim `roles`
 * and resolved at request time against the database (the JWT is the cache, the
 * DB is the source of truth).
 */
export enum Role {
  Radiologist = 'radiologist',
  HospitalUser = 'hospital_user',
  HospitalAdmin = 'hospital_admin',
  Coordinator = 'coordinator',
  Admin = 'admin',
}

export const ALL_ROLES: readonly Role[] = Object.freeze(Object.values(Role));
