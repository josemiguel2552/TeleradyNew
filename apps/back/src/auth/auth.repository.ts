import { Injectable } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DBOrTx } from "../database/drizzle";
import { authUser } from "../database/schema";

@Injectable()
export class AuthRepository {
    constructor() { }

    async getUserByIdEmail(db: DBOrTx, idUser: string, email: string) {
        const user = await db.select().from(authUser).where(and(
            eq(authUser.id, idUser), eq(authUser.email, email)
        )).execute();

        return user.length > 0 ? user[0] : null;
    }
}