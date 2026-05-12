import { Injectable } from "@nestjs/common";
import { subspecialtyInTelerady } from "../../../database/schema";
import { I18nService } from "../../../i18n/i18n.service";
import { DBOrTx } from "../../../database/drizzle";

@Injectable()
export class ParametersRepository {
    constructor(private readonly i18n: I18nService) { }

    private mappingData(data: any) {
        return data.map((dato: any) => (
            { id: dato.id, name: dato.name ?? 'NN' }
        ));
    }

    async getSubspecialties(db: DBOrTx) {
        const lang = this.i18n.getLang();
        const field = lang.includes('en') ? subspecialtyInTelerady.nameEn : subspecialtyInTelerady.name;
        const subspecialties = await db.select({ id: subspecialtyInTelerady.id, name: field }).from(subspecialtyInTelerady).execute();

        return this.mappingData(subspecialties);
    }
}