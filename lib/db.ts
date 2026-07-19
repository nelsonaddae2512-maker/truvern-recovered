// lib/db.ts
import prismaDefault from "./prisma";

/**
 * Export prisma both as default and named so callers can do:
 *   import prisma from "@/lib/db"
 *   import { prisma } from "@/lib/db"
 */
export const prisma = prismaDefault;
export default prismaDefault;



