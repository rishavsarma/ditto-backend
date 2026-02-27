import Api from "@/app/functions/Api";
import { verifyOTP } from "@/lib/hash";
import {
  normalizePhone,
  PHONE_REGEX,
  safeParseBody,
  verifyDomain,
} from "@/lib/verifyDomain";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const domainError = verifyDomain(req);
  if (domainError) return domainError;

  const parsed = await safeParseBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { phone, otp } = parsed.data;

  if (!phone)
    return NextResponse.json(
      { success: false, error: "Phone number is required" },
      { status: 400 },
    );
  if (!otp)
    return NextResponse.json(
      { success: false, error: "OTP is required" },
      { status: 400 },
    );
  if (!/^\d{4}$/.test(String(otp)))
    return NextResponse.json(
      { success: false, error: "OTP must be a 4-digit number" },
      { status: 400 },
    );

  const normalizedPhone = normalizePhone(String(phone));
  const dbPhone = normalizedPhone.slice(2);
  if (!PHONE_REGEX.test(normalizedPhone)) {
    return NextResponse.json(
      { success: false, error: "Invalid phone number" },
      { status: 400 },
    );
  }

  const data: any = await Api.get("/otp-verifications", {
    search: `identifier:${dbPhone},type:login,verified:0`,
    sort: "-created_at",
  });
  let record: any;

  if (!data || !data.result || data.result.length === 0) {
    return NextResponse.json(
      { success: false, error: "OTP not sent or already used" },
      { status: 400 },
    );
  }

  record = data.result[0];

  // FrontQL returns timestamps without 'T' and 'Z'. Explicitly parse as UTC.
  const expiresString =
    record.expires_at.replace(" ", "T") +
    (record.expires_at.includes("Z") ? "" : "Z");
  const expiresTime = new Date(expiresString).getTime();

  if (Date.now() > expiresTime) {
    return NextResponse.json(
      { success: false, error: "OTP has expired, please request a new one" },
      { status: 400 },
    );
  }

  const isMatch = await verifyOTP(String(otp), record.otp_hash);
  if (!isMatch) {
    return NextResponse.json(
      { success: false, error: "Invalid OTP" },
      { status: 400 },
    );
  } else {
    await Api.put(`/otp-verifications`, {
      body: {
        id: record.id,
        verified: 1,
        verified_at: new Date().toISOString(),
      },
    });
  }

  let userData = null;
  try {
    const userResp: any = await Api.get("/ditto-new-users", {
      search: `phone:${dbPhone}`,
      sort: "-created_at",
    });

    if (userResp && userResp.result && userResp.result.length > 0) {
      userData = userResp.result[0];
      if (userData.is_active === 0) {
        await Api.put(`/ditto-new_users`, {
          body: {
            id: userData.id,
            is_active: 1,
          },
        });
        userData.is_active = 1;
      }
    } else {
      const createResp: any = await Api.post("/ditto-new-users", {
        body: {
          phone: dbPhone,
          phone_verified: 1,
          registered_source: "Phone",
          is_active: 1,
        },
      });
      let userDataObj: any = {
        phone: dbPhone,
        is_active: 1,
      };
      if (createResp?.result?.lastInsertID) {
        userDataObj.id = createResp.result.lastInsertID;
      }
      userData = userDataObj;
    }
  } catch (error) {
    console.error("Failed to process user after OTP verification", error);
    return NextResponse.json(
      { success: false, error: "Failed to process user data" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    success: true,
    message: "OTP verified successfully",
    user: userData,
  });
}
