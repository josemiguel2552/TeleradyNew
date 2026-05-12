import { RegisterEventDto } from "../models/register-event.dto";

export class RegisterEventCommand {
    constructor(public readonly data: RegisterEventDto) { }
}