type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiRequest = {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || "http://localhost:3000";

function buildHeaders(token?: string, extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function apiFetch<T = unknown>({ path, method = "GET", body, token, headers }: ApiRequest): Promise<T> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method,
    headers: buildHeaders(token, headers),
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error: ApiError = {
      status: response.status,
      message: isJson && payload?.message ? payload.message : "Error en la solicitud",
      details: isJson ? payload : undefined,
    };
    throw error;
  }

  return payload as T;
}
