import { betterAuth } from "better-auth";
import {getPrismaClient} from "@prisma/client/runtime/client";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql", // or "mysql", "sqlite", ...etc
    }),
});

