import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { ValidateQuery } from "../queries/validate.query"
import { InternalServerErrorException } from "@nestjs/common";
import { PersonalDataRepository } from "../repositories/personal-data.repository";
import { ValidateResponse } from "../models/validate.entity";
import { I18nService } from "../../../i18n/i18n.service";
import { db } from "../../../database/drizzle";

@QueryHandler(ValidateQuery)
export class ValidateHandler implements IQueryHandler<ValidateQuery> {
    constructor(private readonly personalDataRepository: PersonalDataRepository, private readonly i18n: I18nService) { }

    async execute(query: ValidateQuery): Promise<ValidateResponse> {
        try {
            const validate = await this.personalDataRepository.validateProfessional(db, query.email);
            return { ok: true, message: '', response: { exists: validate } };
        }
        catch (err) {
            console.error('ValidateHandler', err);
            throw new InternalServerErrorException(this.i18n.translate('personalData.validateProfessional.errorMessage'));
        }
    }
}
