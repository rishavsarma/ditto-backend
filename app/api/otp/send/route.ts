import Api from "@/app/functions/Api";
import { hashOTP } from "@/lib/hash";
import {
  normalizePhone,
  PHONE_REGEX,
  safeParseBody,
  verifyDomain,
} from "@/lib/verifyDomain";
import axios from "axios";
import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const API_URL = "http://japi.instaalerts.zone/httpapi/QueryStringReceiver";
const SENDER = "DITTOO";
const DLT_ENTITY_ID = "1101508840000028925";
const DLT_TEMPLATE_ID = "1107165295604139145";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Fail fast — crash at startup if env var is missing
const API_KEY = process.env.INSTAALERTS_API_KEY;

const generateOTP = (): string => randomInt(1000, 10000).toString();

export async function POST(req: NextRequest) {
  const domainError = verifyDomain(req);
  if (domainError) return domainError;

  if (!API_KEY) {
    return NextResponse.json(
      { success: false, error: "SMS gateway not configured" },
      { status: 500 },
    );
  }

  const parsed = await safeParseBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { phone } = parsed.data;

  if (!phone) {
    return NextResponse.json(
      { success: false, error: "Phone number is required" },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizePhone(String(phone));
  const dbPhone = normalizedPhone.slice(2);

  if (!PHONE_REGEX.test(normalizedPhone)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid phone number. Must be a valid 10-digit Indian mobile number",
      },
      { status: 400 },
    );
  }

  try {
    const recentOtpData: any = await Api.get("/otp-verifications", {
      search: `identifier:${dbPhone},type:login,verified:0`,
      sort: "-created_at",
    });

    if (
      recentOtpData &&
      recentOtpData.result &&
      recentOtpData.result.length > 0
    ) {
      const record = recentOtpData.result[0];
      const expiresString =
        record.expires_at.replace(" ", "T") +
        (record.expires_at.includes("Z") ? "" : "Z");
      const expiresTime = new Date(expiresString).getTime();

      if (Date.now() <= expiresTime) {
        return NextResponse.json(
          { success: false, error: "Your previous otp is still active." },
          { status: 400 },
        );
      }
    }

    const otp = generateOTP();
    const text = `Hi,your OTP code iss ${otp}. Enter this code to confirm your mobile number in https://dittoapp.in -DITTOAPPIN`;

    const { data } = await axios.post(API_URL, null, {
      params: {
        ver: "1.0",
        key: API_KEY,
        encrpt: "0",
        dest: normalizedPhone,
        send: SENDER,
        text,
        dlt_entity_id: DLT_ENTITY_ID,
        dlt_template_id: DLT_TEMPLATE_ID,
      },
    });

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

    const hashedOtp = await hashOTP(otp);

    await Api.post("/otp-verifications", {
      body: {
        identifier: dbPhone,
        otp_hash: hashedOtp,
        type: "login",
        expires_at: expiresAt,
        verified: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully.`,
    });
  } catch (error: unknown) {
    const message = axios.isAxiosError(error)
      ? (error.response?.data ?? error.message)
      : error instanceof Error
        ? error.message
        : "An unexpected error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
