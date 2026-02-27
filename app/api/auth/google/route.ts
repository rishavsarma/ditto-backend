import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "837906273230-8vq69hc0ti8dtmi6482psp6tef74qi5m.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: "No ID token provided" },
        { status: 400 },
      );
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json(
        { error: "Invalid token payload" },
        { status: 401 },
      );
    }

    // Usually you would find or create the user in your database here
    // For now we'll just return the user profile data
    return NextResponse.json({
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        firstName: payload.given_name,
        lastName: payload.family_name,
        avatar: payload.picture,
        emailVerified: payload.email_verified,
        role: "BUYER",
        subdomain: "buyer",
        authProvider: "google",
      },
    });
  } catch (error: any) {
    console.error("Google Auth Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to authenticate" },
      { status: 401 },
    );
  }
}
