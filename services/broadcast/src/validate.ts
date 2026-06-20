import { Request, Response } from "express";
import { ZodType } from "zod";

/**
 * Parses and validates req.body against `schema`. On failure, responds 400
 * with the validation issues and returns null — callers must check for that
 * and return early, since a response has already been sent in that case.
 */
export function parseBody<T>(
  schema: ZodType<T>,
  req: Request,
  res: Response
): T | null {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid payload",
      details: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return null;
  }

  return result.data;
}
