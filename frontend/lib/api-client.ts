export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  notifyUnauthorized?: boolean
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "")

export async function apiRequest<T>(
  path: string,
  { body, headers, notifyUnauthorized = true, ...options }: ApiRequestOptions = {},
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError("NEXT_PUBLIC_API_BASE_URL is not configured.", 0)
  }

  const requestHeaders = new Headers(headers)
  requestHeaders.set("Accept", "application/json")

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json")
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      headers: requestHeaders,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    throw new ApiError("Unable to connect to the BrewAnalytics API.", 0)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(
      `The API returned an invalid response (HTTP ${response.status}).`,
      response.status,
    )
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `The API request failed (HTTP ${response.status}).`

    if (
      response.status === 401 &&
      notifyUnauthorized &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event("auth:unauthorized"))
    }

    throw new ApiError(message, response.status)
  }

  return payload as T
}
