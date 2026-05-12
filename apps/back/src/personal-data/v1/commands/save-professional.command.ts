import { SaveProfessionalDto } from "../models/save-professional.dto";

export class SaveProfessionalCommand {
    constructor(public readonly data: SaveProfessionalDto) { }
}