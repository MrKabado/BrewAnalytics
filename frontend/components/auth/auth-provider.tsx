"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { ApiError, apiRequest } from "@/lib/api-client"
import { toast } from "sonner"
import type {
  AuthResponse,
  AuthUser,
  CurrentUserResponse,
  LoginRequest,
  LogoutResponse,
} from "@/lib/auth-types"

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unavailable"

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiRequest<unknown>("/api/auth/me", {
    method: "GET",
    notifyUnauthorized: false,
  })
  if (!isCurrentUserResponse(response)) {
    throw new ApiError("The API returned an invalid session response.", 502)
  }
  return response.user
}

function isAuthUser(value: unknown): value is AuthUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "role" in value &&
    value.role === "ADMIN"
  )
}

function isCurrentUserResponse(value: unknown): value is CurrentUserResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "success" &&
    "user" in value &&
    isAuthUser(value.user)
  )
}

function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    isCurrentUserResponse(value) &&
    "message" in value &&
    typeof value.message === "string"
  )
}

function isLogoutResponse(value: unknown): value is LogoutResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "success" &&
    "message" in value &&
    typeof value.message === "string"
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")

  const refresh = useCallback(async () => {
    setStatus("loading")
    try {
      setUser(await getCurrentUser())
      setStatus("authenticated")
    } catch (error) {
      setUser(null)
      setStatus(
        error instanceof Error &&
          "status" in error &&
          error.status === 401
          ? "unauthenticated"
          : "unavailable",
      )
    }
  }, [])

  useEffect(() => {
    let active = true
    void getCurrentUser().then(
      (currentUser) => {
        if (active) {
          setUser(currentUser)
          setStatus("authenticated")
        }
      },
      (error: unknown) => {
        if (active) {
          setUser(null)
          setStatus(
            error instanceof Error && "status" in error && error.status === 401
              ? "unauthenticated"
              : "unavailable",
          )
        }
      },
    )

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
      setStatus("unauthenticated")
      toast.error("Your session expired. Please sign in again.")
    }

    window.addEventListener("auth:unauthorized", handleUnauthorized)
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized)
  }, [])

  const login = useCallback(async (credentials: LoginRequest) => {
    setStatus("loading")
    let response: unknown
    try {
      response = await apiRequest<unknown>("/api/auth/login", {
        method: "POST",
        body: credentials,
        notifyUnauthorized: false,
      })
    } catch (error) {
      setUser(null)
      setStatus("unauthenticated")
      throw error
    }
    if (!isAuthResponse(response)) {
      setUser(null)
      setStatus("unauthenticated")
      throw new ApiError("The API returned an invalid login response.", 502)
    }
    setUser(response.user)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    const response = await apiRequest<unknown>("/api/auth/logout", {
      method: "POST",
      notifyUnauthorized: false,
    })
    if (!isLogoutResponse(response)) {
      throw new ApiError("The API returned an invalid logout response.", 502)
    }
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const value = useMemo(
    () => ({ user, status, login, logout, refresh }),
    [user, status, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.")
  }
  return context
}
