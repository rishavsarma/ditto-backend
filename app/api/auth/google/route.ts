import Api from "@/app/functions/Api";
import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
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

    const email = payload.email;
    if (!email) {
      return NextResponse.json(
        { error: "No email found in Google payload" },
        { status: 400 },
      );
    }

    let userData = null;

    try {
      const userResp: any = await Api.get("/ditto-new-users", {
        search: `email:${email}`,
        sort: "-created_at",
      });

      if (userResp && userResp.result && userResp.result.length > 0) {
        userData = userResp.result[0];
        if (userData.is_active === 0) {
          await Api.put(`/ditto-new_users`, {
            body: {
              id: userData.id,
              is_active: 1,
              last_login: new Date().toISOString(),
            },
          });
          userData.is_active = 1;
        }
      } else {
        const createResp: any = await Api.post("/ditto-new-users", {
          body: {
            email: email,
            name: payload.name || "",
            avatar: payload.picture || "",
            email_verified: payload.email_verified ? 1 : 0,
            registered_source: "Google",
            registered_id: payload.sub,
            is_active: 1,
            role: "BUYER",
            last_login: new Date().toISOString(),
          },
        });

        let userDataObj: any = {
          email: email,
          name: payload.name || "",
          avatar: payload.picture || "",
          email_verified: payload.email_verified ? 1 : 0,
          registered_source: "Google",
          registered_id: payload.sub,
          role: "BUYER",
          is_active: 1,
        };
        if (createResp?.result?.lastInsertID) {
          userDataObj.id = createResp.result.lastInsertID;
        }
        userData = userDataObj;
      }
    } catch (error) {
      console.error(
        "Failed to process user after Google Auth verification",
        error,
      );
      return NextResponse.json(
        { success: false, error: "Failed to process user data" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Google login successful",
      user: userData,
    });
  } catch (error: any) {
    console.error("Google Auth Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to authenticate" },
      { status: 401 },
    );
  }
}
