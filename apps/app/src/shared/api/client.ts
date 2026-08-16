import { API_URL } from "./constants";

// Thrown for every non-2xx response, so callers can branch on the status (404 in particular)
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function request<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response));

  return (await response.json()) as T;
}

// an aborted request is a cancellation, not a failure
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Nest answers `{ message: string | string[] }`
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    const message = (payload as { message?: unknown } | null)?.message;

    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  } catch {}

  return `${response.status} ${response.statusText}`;
}
