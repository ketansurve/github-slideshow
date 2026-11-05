import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /* Set by authenticate() from a valid, unrevoked session. The role is
         read from the database on every request, not from the token, so a
         role change or account suspension takes effect immediately. */
      user?: { id: string; userId: string; name: string; role: Role; jti: string };
    }
  }
}

export {};
