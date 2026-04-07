export const AUTH_FLAG_KEY = "wadro_authenticated";

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
}

type AuthPayload = {
  username: string;
  password: string;
};

type RegisterPayload = AuthPayload & {
  name?: string;
};

async function handleJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (data as { message?: string }).message ?? "Request failed";
    throw new Error(message);
  }

  return data;
}

export async function loginUser(payload: AuthPayload) {
  const response = await fetch(`${getBaseUrl()}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleJsonResponse(response);
  localStorage.setItem(AUTH_FLAG_KEY, "true");
  return data;
}

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch(`${getBaseUrl()}/api/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await handleJsonResponse(response);
  return data;
}

export function isAuthenticated() {
  return localStorage.getItem(AUTH_FLAG_KEY) === "true";
}

export async function logoutUser() {
  try {
    const response = await fetch(`${getBaseUrl()}/api/logout`, {
      method: "POST",
      credentials: "include",
    });

    await handleJsonResponse(response);
  } finally {
    localStorage.removeItem(AUTH_FLAG_KEY);
  }
}
