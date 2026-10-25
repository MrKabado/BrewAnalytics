export type AuthUser = {
  id: string
  name: string
  email: string
  role: "ADMIN"
}

export type LoginRequest = {
  email: string
  password: string
}

export type AuthResponse = {
  status: "success"
  message: string
  user: AuthUser
}

export type LogoutResponse = {
  status: "success"
  message: string
}

export type CurrentUserResponse = {
  status: "success"
  user: AuthUser
}
