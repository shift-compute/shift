import "server-only";
import type { User } from "@shift/core";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { getConfig, getDb } from "./server";

/** The session holds only the user id: identity is the 0G account behind the management key (plan §17). */
export interface SessionData {
  userId?: string;
}

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function sessionOptions(): SessionOptions {
  return {
    password: getConfig().SESSION_SECRET,
    cookieName: "shift_session",
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: THIRTY_DAYS, path: "/" },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** The signed-in user, or null when there is no session or the user no longer exists. */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = await getSession();
  if (!userId) return null;
  return getDb().user.findUnique({ where: { id: userId } });
}
