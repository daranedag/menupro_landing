import { apiFetch } from "../../lib/api/client";

export type AuthPayload = {
  email: string;
  password: string;
};

export async function login(payload: AuthPayload) {
  return apiFetch<{ token: string; refreshToken?: string }>({
    path: "/auth/login",
    method: "POST",
    body: payload,
  });
}

export async function register(payload: AuthPayload) {
  return apiFetch<{ userId: string }>({
    path: "/auth/register",
    method: "POST",
    body: payload,
  });
}
