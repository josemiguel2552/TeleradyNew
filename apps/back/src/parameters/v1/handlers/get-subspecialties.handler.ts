import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { GetSubspecialtiesQuery } from "../queries/get-subspecialties.query"
import { InternalServerErrorException } from "@nestjs/common";
import { ParametersRepository } from "../repositories/parameters.repository";
import { GetParameterResponse } from "../models/get-parameters.entity";
import { I18nService } from "../../../i18n/i18n.service";
import { db } from "../../../database/drizzle";

@QueryHandler(GetSubspecialtiesQuery)
export class GetSubspecialtiesHandler implements IQueryHandler<GetSubspecialtiesQuery> {
    constructor(private readonly parametersRepository: ParametersRepository, private readonly i18n: I18nService) { }

    async execute(query: GetSubspecialtiesQuery): Promise<GetParameterResponse> {
        try {
            const subspecialties = await this.parametersRepository.getSubspecialties(db);
            return {
                ok: true,
                message: subspecialties.length == 0 ? this.i18n.translate('parameters.subspecialties.noData') : '',
                response: subspecialties
            };
        }
        catch (err) {
            console.error('GetSubspecialtiesHandler', err);
            throw new InternalServerErrorException(this.i18n.translate('parameters.subspecialties.errorMessage'));
        }
    }
}
