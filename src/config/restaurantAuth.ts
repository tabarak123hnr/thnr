/** Dedicated restaurant POS login — redirects to the parcel system. */
export const RESTAURANT_LOGIN = {
  email: "adminhnr@example.com",
  password: "adminhnr",
  homePath: "/restaurant/parcel",
} as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isRestaurantEmail(email: string | null | undefined) {
  if (!email) return false;
  return normalizeEmail(email) === RESTAURANT_LOGIN.email;
}

export function isRestaurantCredentials(email: string, password: string) {
  return (
    normalizeEmail(email) === RESTAURANT_LOGIN.email &&
    password === RESTAURANT_LOGIN.password
  );
}
