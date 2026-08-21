export function createJsonRequest(
  url: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
  } = {},
): Request {
  const method = init.method ?? "POST";
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    method,
    headers,
    body:
      init.body === undefined
        ? undefined
        : JSON.stringify(init.body),
  });
}

export function createRouteContext<T extends Record<string, string>>(
  params: T,
): {
  params: Promise<T>;
} {
  return {
    params: Promise.resolve(params),
  };
}

export async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  return (await response.json()) as T;
}
