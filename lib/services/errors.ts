export type ServiceErrorCode = "VALIDATION" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT";

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
};

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(code: ServiceErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}
