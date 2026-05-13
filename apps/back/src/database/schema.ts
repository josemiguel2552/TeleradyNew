import { pgTable, unique, serial, text, uuid, timestamp, integer, boolean, jsonb, varchar, customType, numeric, pgSchema } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
	dataType() {
		return "bytea";
	},
});

export const telerady = pgSchema("telerady");

export const userRole = pgTable("user_role", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("user_role_name_key").on(table.name),
]);

export const authUser = pgTable("auth_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	password: text(),
	sessiontype: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	accessHomologation: boolean("access_homologation").default(false),
}, (table) => [
	unique("auth_user_email_key").on(table.email),
]);

export const getTitle = pgTable("get_title", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("get_title_name_key").on(table.name),
]);

export const getTitleSpecialty = pgTable("get_title_specialty", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("get_title_specialty_name_key").on(table.name),
]);

export const province = pgTable("province", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("province_name_key").on(table.name),
]);

export const specialty = pgTable("specialty", {
	id: serial().primaryKey().notNull(),
	roleId: serial("role_id").notNull(),
	name: text(),
}, (table) => [
	unique("specialty_name_key").on(table.name),
]);

export const contract = pgTable("contract", {
	id: integer().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("contract_name_key").on(table.name),
]);

export const modality = pgTable("modality", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("modality_name_key").on(table.name),
]);

export const currentSituation = pgTable("current_situation", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("current_situation_name_key").on(table.name),
]);

export const gender = pgTable("gender", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("gender_name_key").on(table.name),
]);

export const countryCodeIban = pgTable("country_code_iban", {
	id: serial().primaryKey().notNull(),
	name: text(),
	code: text(),
}, (table) => [
	unique("country_code_iban_name_key").on(table.name),
]);

export const employmentPreference = pgTable("employment_preference", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	questionId: serial("question_id").notNull(),
	answerId: serial("answer_id").notNull(),
});

export const transferBalance = pgTable("transfer_balance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	pay: text(),
	titular: text(),
	bank: text(),
	countryCodeIbanId: serial("country_code_iban_id").notNull(),
	iban: text(),
	bic: text(),
}, (table) => [
	unique("transfer_balance_auth_user_id_key").on(table.authUserId),
]);

export const employmentPreferenceQuestion = pgTable("employment_preference_question", {
	id: serial().primaryKey().notNull(),
	question: text(),
	enable: boolean().notNull(),
	withAnswer: boolean("with_answer").notNull(),
	type: text(),
	field: text(),
}, (table) => [
	unique("employment_preference_question_question_key").on(table.question),
]);

export const salary = pgTable("salary", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("salary_name_key").on(table.name),
]);

export const formationExperience = pgTable("formation_experience", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	currentSituationId: serial("current_situation_id").notNull(),
	specialtyId: serial("specialty_id").notNull(),
	yearsExperience: text("years_experience"),
	aboutMe: text("about_me"),
	collegiateNumber: text("collegiate_number"),
	nameFileCv: text("name_file_cv"),
	nameFileCollegiate: text("name_file_collegiate"),
	fileCvId: text("file_cv_id"),
	fileCollegiateId: text("file_collegiate_id"),
	summaryCv: text("summary_cv"),
	levelEnglishId: integer("level_english_id"),
	saudiArabia: boolean("saudi_arabia").default(false),
}, (table) => [
	unique("formation_experience_auth_user_id_key").on(table.authUserId),
]);

export const personalData = pgTable("personal_data", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	name: text(),
	phone: text(),
	genderId: serial("gender_id").notNull(),
	nationalityId: serial("nationality_id").notNull(),
	address: text(),
	postalCode: text("postal_code"),
	location: text(),
	userRoleId: serial("user_role_id").notNull(),
	contractId: serial("contract_id").notNull(),
	getTitleId: serial("get_title_id").notNull(),
	getTitleSpecialtyId: serial("get_title_specialty_id").notNull(),
	namePhoto: text("name_photo"),
	photo: bytea("photo"),
	lastName: text("last_name"),
	countryId: integer("country_id"),
	cityId: integer("city_id"),
}, (table) => [
	unique("personal_data_auth_user_id_key").on(table.authUserId),
]);

export const questionAnswer = pgTable("question_answer", {
	id: serial().primaryKey().notNull(),
	answer: text(),
	type: serial().notNull(),
	enable: boolean().notNull(),
});

export const stateOffer = pgTable("state_offer", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("state_offer_name_key").on(table.name),
]);

export const offerValue = pgTable("offer_value", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("offer_value_name_key").on(table.name),
]);

export const payMethod = pgTable("pay_method", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("pay_method_name_key").on(table.name),
]);

export const contractDuration = pgTable("contract_duration", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("contract_duration_name_key").on(table.name),
]);

export const workload = pgTable("workload", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("workload_name_key").on(table.name),
]);

export const authHospital = pgTable("auth_hospital", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	email: text().notNull(),
	password: text(),
	sessiontype: text().notNull(),
	isAdmin: boolean("is_admin").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	haveAccess: boolean("have_access").default(false),
}, (table) => [
	unique("auth_hospital_email_key").on(table.email),
]);

export const offerUser = pgTable("offer_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	offerId: uuid("offer_id"),
	offerValueId: serial("offer_value_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const offer = pgTable("offer", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	title: text(),
	stateId: serial("state_id").notNull(),
	description: text(),
	salary: text(),
	payMethodId: serial("pay_method_id").notNull(),
	address: text(),
	contractId: serial("contract_id").notNull(),
	contractDurationId: serial("contract_duration_id").notNull(),
	specialtyId: serial("specialty_id").notNull(),
	professionId: serial("profession_id").notNull(),
	provinceId: serial("province_id").notNull(),
	modalityId: serial("modality_id").notNull(),
	scheduleId: serial("schedule_id").notNull(),
	workloadId: serial("workload_id").notNull(),
	incorporationDate: timestamp("incorporation_date", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	outstanding: boolean().default(false),
	additionalInfo: text("additional_info"),
});

export const offerUserFavorite = pgTable("offer_user_favorite", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	offerId: uuid("offer_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const continent = pgTable("continent", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("continent_name_key").on(table.name),
]);

export const offerProposal = pgTable("offer_proposal", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	offerId: uuid("offer_id"),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	isRead: boolean("is_read").default(false),
});

export const country = pgTable("country", {
	id: serial().primaryKey().notNull(),
	name: text(),
	continentId: serial("continent_id").notNull(),
}, (table) => [
	unique("country_name_key").on(table.name),
]);

export const offerObservation = pgTable("offer_observation", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	offerId: uuid("offer_id"),
	comment: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const conversation = pgTable("conversation", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	authUserId: uuid("auth_user_id"),
});

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationId: uuid("conversation_id").notNull(),
	offerId: uuid("offer_id"),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const assistantSessions = pgTable("assistant_sessions", {
	id: uuid().primaryKey().notNull(),
	messages: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const conversationManager = pgTable("conversation_manager", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	managerUserId: uuid("manager_user_id"),
});

export const messagesManager = pgTable("messages_manager", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conversationManagerId: uuid("conversation_manager_id").notNull(),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
});

export const city = pgTable("city", {
	id: serial().primaryKey().notNull(),
	name: text(),
	countryId: serial("country_id").notNull(),
});

export const offerRequirements = pgTable("offer_requirements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	offerId: uuid("offer_id"),
	requirementType: varchar("requirement_type", { length: 50 }).notNull(),
	requirementValue: integer("requirement_value").notNull(),
});

export const planHospital = pgTable("plan_hospital", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	planId: integer("plan_id").default(1),
	active: boolean().default(true),
	usageOffer: integer("usage_offer").default(0),
	dateStart: timestamp("date_start", { mode: 'string' }).notNull(),
	dateStartOffers: timestamp("date_start_offers", { mode: 'string' }).notNull(),
	viewProfile: integer("view_profile").default(0),
});

export const plans = pgTable("plans", {
	id: serial().primaryKey().notNull(),
	name: text(),
	usageOfferLimit: integer("usage_offer_limit"),
	timeLimitDaysOffer: integer("time_limit_days_offer"),
	accessDocsDays: integer("access_docs_days"),
	donwloadDocs: boolean("donwload_docs").default(false),
	accessChat: boolean("access_chat").default(false),
	viewProfileLimit: integer("view_profile_limit"),
	haveManager: boolean("have_manager").default(false),
	useFilterLatam: boolean("use_filter_latam").default(false),
	showProfileLatam: integer("show_profile_latam"),
}, (table) => [
	unique("plans_name_key").on(table.name),
]);

export const responsible = pgTable("responsible", {
	id: integer().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("responsible_name_key").on(table.name),
]);

export const vacant = pgTable("vacant", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("vacant_name_key").on(table.name),
]);

export const dataFormUser = pgTable("data_form_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	lastName: text("last_name"),
	email: text(),
	prefix: text(),
	phone: text(),
	subspecialty: text(),
	nationalityId: integer("nationality_id"),
	provinceId: integer("province_id"),
	rolId: integer("rol_id"),
	specialtyId: integer("specialty_id"),
	getTitleId: integer("get_title_id"),
	getTitleSpecialtyId: integer("get_title_specialty_id"),
	preferenceProvinceId: integer("preference_province_id"),
	aboutme: text(),
	nameFileCv: text("name_file_cv"),
	fileCvId: text("file_cv_id"),
	countryId: integer("country_id"),
	cityId: integer("city_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	levelEnglishId: integer("level_english_id"),
	saudiArabia: boolean("saudi_arabia").default(false),
	summaryCv: text("summary_cv"),
});

export const payments = pgTable("payments", {
	id: serial().primaryKey().notNull(),
	hospitalId: varchar("hospital_id", { length: 255 }),
	email: varchar({ length: 255 }),
	paymentId: varchar("payment_id", { length: 255 }),
	productId: varchar("product_id", { length: 255 }),
	priceId: varchar("price_id", { length: 255 }),
	description: text(),
	amount: integer(),
	currency: varchar({ length: 10 }),
	paymentStatus: varchar("payment_status", { length: 50 }),
	paymentMethod: varchar("payment_method", { length: 50 }),
	paymentDate: timestamp("payment_date", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	paymentLinkId: varchar("payment_link_id", { length: 255 }),
});

export const hospital = pgTable("hospital", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	address: text(),
	provinceId: serial("province_id").notNull(),
	countryId: serial("country_id").notNull(),
	photo: bytea("photo"),
	namePhoto: text("name_photo"),
	bedsNumber: text("beds_number"),
	operatingRoomNumber: text("operating_room_number"),
	description: text(),
	roleInterestId: integer("role_interest_id"),
	responsibleId: integer("responsible_id"),
	nameResponsible: text("name_responsible"),
	otherResponsible: text("other_responsible"),
	phone: text(),
	vacantsId: integer("vacants_id"),
	contractId: integer("contract_id"),
	homologationId: integer("homologation_id"),
	cityId: integer("city_id"),
});

export const countriesBusiness = pgTable("countries_business", {
	id: serial().primaryKey().notNull(),
	countryId: integer("country_id").notNull(),
});

export const levelEnglish = pgTable("level_english", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("level_english_name_key").on(table.name),
]);

export const chatQueries = pgTable("chat_queries", {
	id: serial().primaryKey().notNull(),
	question: text().notNull(),
	answer: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	unique("chat_queries_question_key").on(table.question),
]);

export const homologationFiles = pgTable("homologation_files", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("homologation_files_name_key").on(table.name),
]);

export const homologationUserFiles = pgTable("homologation_user_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	homologationFileId: integer("homologation_file_id"),
	nameFile: text("name_file"),
	driveFileId: text("drive_file_id"),
});

export const titleForHomologation = pgTable("title_for_homologation", {
	id: serial().primaryKey().notNull(),
	name: text(),
}, (table) => [
	unique("title_for_homologation_name_key").on(table.name),
]);

export const homologationPreferen = pgTable("homologation_preferen", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	authUserId: uuid("auth_user_id"),
	rolId: serial("rol_id").notNull(),
	countryId: serial("country_id").notNull(),
	titleForHomologationId: serial("title_for_homologation_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const professionalDocumentInTelerady = telerady.table("professional_document", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	professionalId: uuid("professional_id"),
	documentId: integer("document_id").notNull(),
	nameDocument: varchar("name_document", { length: 150 }).default(sql`NULL`),
	// Legacy Drive identifier, deprecated. New uploads write storage_key /
	// storage_bucket and the reader falls back to drive_id only for rows
	// that pre-date the S3 migration.
	driveId: varchar("drive_id", { length: 50 }).default(sql`NULL`),
	storageBucket: varchar("storage_bucket", { length: 50 }),
	storageKey: varchar("storage_key", { length: 250 }),
});

export const freelancerDataInTelerady = telerady.table("freelancer_data", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	professionalId: uuid("professional_id"),
	registrationNumber: varchar("registration_number", { length: 50 }).notNull(),
	// Legacy plaintext column. Nullable so new code only writes the encrypted
	// sibling. Drop in Sprint 2.
	bankAccount: varchar("bank_account", { length: 50 }),
	bankAccountEnc: text("bank_account_enc"),
});

export const professionalAvailabilityInTelerady = telerady.table("professional_availability", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	professionalId: uuid("professional_id"),
	availableDays: varchar("available_days", { length: 255 }),
	availableTimes: varchar("available_times", { length: 255 }),
});

export const workPreferencesInTelerady = telerady.table("work_preferences", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	professionalId: uuid("professional_id"),
	workingModalityId: integer("working_modality_id"),
	salaryExpectationId: numeric("salary_expectation_id", { precision: 10, scale:  2 }).notNull(),
	contractType: integer("contract_type"),
});

export const professionalSubspecialtyInTelerady = telerady.table("professional_subspecialty", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	professionalId: uuid("professional_id"),
	subspecialtyId: integer("subspecialty_id").notNull(),
});

export const subspecialtyInTelerady = telerady.table("subspecialty", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	nameEn: varchar("name_en", { length: 100 }).notNull(),
});

export const professionalInTelerady = telerady.table("professional", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	name: varchar({ length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	cityResidence: varchar("city_residence", { length: 100 }).notNull(),
	titleStatusId: integer("title_status_id"),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 150 }).notNull(),
	professionalLicense: varchar("professional_license", { length: 50 }),
}, (table) => [
	unique("professional_email_key").on(table.email),
]);

export const documentInTelerady = telerady.table("document", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	nameEn: varchar("name_en", { length: 100 }).notNull(),
});


export const reportStatesInTelerady = telerady.table("report_states", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	nameEn: varchar("name_en", { length: 100 }).notNull(),
}, (table) => [
	unique("report_states_name_key").on(table.name),
]);

export const reportStudyInTelerady = telerady.table("report_study", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	professionalId: uuid("professional_id").notNull(),
	studyIuid: varchar("study_iuid", { length: 150 }).notNull(),
	studyDesc: varchar("study_desc", { length: 150 }).notNull(),
	// Legacy plaintext columns. Nullable so new code can write only the
	// encrypted siblings. To be dropped in Sprint 2.
	patId: varchar("pat_id", { length: 150 }),
	patName: varchar("pat_name", { length: 150 }),
	patBirthdate: varchar("pat_birthdate", { length: 150 }),
	// Encrypted siblings (AES-256-GCM packed envelope) + deterministic
	// HMAC of pat_id for lookups without re-identification.
	patIdEnc: text("pat_id_enc"),
	patIdHash: varchar("pat_id_hash", { length: 64 }),
	patNameEnc: text("pat_name_enc"),
	patBirthdateEnc: text("pat_birthdate_enc"),
	sex: varchar({ length: 150 }).notNull(),
	modalities: varchar({ length: 50 }).array(),
	institution: varchar({ length: 150 }).notNull(),
	src: varchar({ length: 150 }).notNull(),
	studyCreatedTime: timestamp("study_created_time", { withTimezone: true, mode: 'string' }),
	reportStateId: integer("report_state_id").notNull(),
	reportRegisteredTime: timestamp("report_registered_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reportSentTime: timestamp("report_sent_time", { withTimezone: true, mode: 'string' }),
	reportIdApi: varchar("report_id_api", { length: 150 }),
});

export const eventLogInTelerady = telerady.table("event_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	professionalId: uuid("professional_id").notNull(),
	eventType: varchar("event_type", { length: 100 }).notNull(),
	eventPayload: jsonb("event_payload").notNull(),
	eventTimestamp: timestamp("event_timestamp", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const auditLogInTelerady = telerady.table("audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ts: timestamp("ts", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actorId: uuid("actor_id"),
	actorRole: varchar("actor_role", { length: 50 }),
	hospitalId: uuid("hospital_id"),
	action: varchar("action", { length: 100 }).notNull(),
	targetKind: varchar("target_kind", { length: 50 }).notNull(),
	targetId: varchar("target_id", { length: 150 }),
	payload: jsonb("payload").notNull(),
	prevHash: varchar("prev_hash", { length: 64 }),
	hash: varchar("hash", { length: 64 }).notNull(),
	requestIp: varchar("request_ip", { length: 45 }),
	requestUa: varchar("request_ua", { length: 255 }),
});

// =====================================================================
// Sprint 1 — Multi-tenant model (Telerady-native, not the BookHospital
// legacy carried over from the imported repo).
// =====================================================================

export const hospitalSignaturePolicy = ['name_collegiate', 'drawn_hash_tsa'] as const;
export type HospitalSignaturePolicy = (typeof hospitalSignaturePolicy)[number];

export const hospitalInTelerady = telerady.table("hospital", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	taxId: varchar("tax_id", { length: 50 }),
	signaturePolicy: varchar("signature_policy", { length: 40 }).default('name_collegiate').notNull(),
	retentionDays: integer("retention_days").default(3650).notNull(),
	active: boolean().default(true).notNull(),
	aiDraftingAllowed: boolean("ai_drafting_allowed").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("hospital_tax_id_key").on(table.taxId),
]);

export const appUserInTelerady = telerady.table("app_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 200 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	mfaSecretEnc: text("mfa_secret_enc"),
	mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
	professionalId: uuid("professional_id"),
	failedAttempts: integer("failed_attempts").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	processingRestricted: boolean("processing_restricted").default(false).notNull(),
	aiConsentAt: timestamp("ai_consent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("app_user_email_key").on(table.email),
]);

export const userRoleAssignmentInTelerady = telerady.table("user_role_assignment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	role: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("user_role_assignment_user_role_key").on(table.userId, table.role),
]);

export const hospitalMembershipInTelerady = telerady.table("hospital_membership", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	hospitalId: uuid("hospital_id").notNull(),
	isAdmin: boolean("is_admin").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("hospital_membership_user_hospital_key").on(table.userId, table.hospitalId),
]);

export const refreshTokenInTelerady = telerady.table("refresh_token", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: varchar("token_hash", { length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	replacedById: uuid("replaced_by_id"),
	ip: varchar({ length: 45 }),
	ua: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("refresh_token_hash_key").on(table.tokenHash),
]);

export const reportStates = ['draft', 'finalized', 'signed', 'sent'] as const;
export type ReportState = (typeof reportStates)[number];

export const reportInTelerady = telerady.table("report", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	reportStudyId: uuid("report_study_id").notNull(),
	hospitalId: uuid("hospital_id"),
	professionalId: uuid("professional_id").notNull(),
	version: integer().default(1).notNull(),
	state: varchar({ length: 20 }).default('draft').notNull(),
	contentsEnc: text("contents_enc"),
	signatureData: jsonb("signature_data"),
	pdfBucket: varchar("pdf_bucket", { length: 50 }),
	pdfKey: varchar("pdf_key", { length: 250 }),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	requiresReview: boolean("requires_review").default(false).notNull(),
	reviewerProfessionalId: uuid("reviewer_professional_id"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewApproved: boolean("review_approved"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("report_study_unique").on(table.reportStudyId),
]);

export const mwlEntryInTelerady = telerady.table("mwl_entry", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	accessionNumber: varchar("accession_number", { length: 64 }),
	scheduledStationAet: varchar("scheduled_station_aet", { length: 16 }),
	patientIdHash: varchar("patient_id_hash", { length: 64 }),
	patientIdEnc: text("patient_id_enc"),
	patientNameEnc: text("patient_name_enc"),
	patientBirthdateEnc: text("patient_birthdate_enc"),
	patientSex: varchar("patient_sex", { length: 4 }),
	studyDescription: varchar("study_description", { length: 150 }),
	scheduledDate: varchar("scheduled_date", { length: 8 }),
	scheduledTime: varchar("scheduled_time", { length: 6 }),
	modality: varchar({ length: 16 }),
	requestingPhysician: varchar("requesting_physician", { length: 150 }),
	state: varchar({ length: 20 }).default('scheduled').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const hl7MessageInTelerady = telerady.table("hl7_message", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	direction: varchar({ length: 4 }).notNull(),
	messageType: varchar("message_type", { length: 16 }).notNull(),
	controlId: varchar("control_id", { length: 64 }),
	payloadEnc: text("payload_enc").notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const mppsEventInTelerady = telerady.table("mpps_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	performedProcedureStepId: varchar("performed_procedure_step_id", { length: 64 }).notNull(),
	accessionNumber: varchar("accession_number", { length: 64 }),
	studyIuid: varchar("study_iuid", { length: 150 }),
	status: varchar({ length: 20 }).notNull(),
	modality: varchar({ length: 16 }),
	stationName: varchar("station_name", { length: 64 }),
	hospitalId: uuid("hospital_id"),
	mwlEntryId: uuid("mwl_entry_id"),
	reportStudyId: uuid("report_study_id"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	rawPayloadEnc: text("raw_payload_enc"),
	receivedAt: timestamp("received_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	error: text(),
});

export const assignmentRuleInTelerady = telerady.table("assignment_rule", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	hospitalId: uuid("hospital_id"),
	modality: varchar({ length: 20 }),
	subspecialtyId: integer("subspecialty_id"),
	targetProfessionalId: uuid("target_professional_id"),
	priority: integer().default(100).notNull(),
	requiresReview: boolean("requires_review").default(false).notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});