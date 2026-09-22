export const EMAIL_COOKIE = "innovin_email";
export const DEVICE_COOKIE = "innovin_device";

export const longLivedCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
};
