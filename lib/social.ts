import type { SocialMedium } from "./api";

export type SocialProfile = {
  id: string;
  name: string;
  email: string;
  token: string;
  medium: Extract<SocialMedium, "google" | "facebook">;
};

type GoogleTokenResponse = { access_token?: string; error?: string };
type GoogleTokenClient = { requestAccessToken: () => void };
type FacebookLoginResponse = { authResponse?: { accessToken: string; userID: string }; status?: string };
type FacebookProfile = { id?: string; name?: string; email?: string };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => GoogleTokenClient;
        };
      };
    };
    FB?: {
      init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string }) => void;
      api: (path: string, params: Record<string, string>, callback: (response: FacebookProfile) => void) => void;
    };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const FACEBOOK_APP_ID = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? "";

function loadExternalScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Sign-in could not load. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

export async function requestGoogleProfile(): Promise<SocialProfile> {
  await loadExternalScript("google-identity-services", "https://accounts.google.com/gsi/client");
  const initTokenClient = window.google?.accounts?.oauth2?.initTokenClient;
  if (!initTokenClient) throw new Error("Google sign-in is unavailable right now.");
  return new Promise((resolve, reject) => {
    const client = initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        try {
          if (response.error || !response.access_token) throw new Error("Google sign-in was cancelled.");
          const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(response.access_token)}`);
          if (!res.ok) throw new Error("Your Google profile could not be loaded.");
          const profile = (await res.json()) as { sub?: string; name?: string; email?: string };
          if (!profile.sub || !profile.email) throw new Error("Google did not share an email address.");
          resolve({ id: profile.sub, name: profile.name || profile.email, email: profile.email, token: response.access_token, medium: "google" });
        } catch (error) {
          reject(error);
        }
      }
    });
    client.requestAccessToken();
  });
}

export async function requestFacebookProfile(): Promise<SocialProfile> {
  await loadExternalScript("facebook-jssdk", "https://connect.facebook.net/en_US/sdk.js");
  const facebook = window.FB;
  if (!facebook) throw new Error("Facebook sign-in is unavailable right now.");
  facebook.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: "v19.0" });
  return new Promise((resolve, reject) => {
    facebook.login((loginResponse) => {
      const accessToken = loginResponse.authResponse?.accessToken;
      if (!accessToken) {
        reject(new Error("Facebook sign-in was cancelled."));
        return;
      }
      facebook.api("/me", { fields: "id,name,email" }, (profile) => {
        if (!profile.id || !profile.email) {
          reject(new Error("Facebook did not share an email address."));
          return;
        }
        resolve({ id: profile.id, name: profile.name || profile.email, email: profile.email, token: accessToken, medium: "facebook" });
      });
    }, { scope: "email,public_profile" });
  });
}
