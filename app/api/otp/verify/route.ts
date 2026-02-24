import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone, PHONE_REGEX, safeParseBody, verifyDomain } from '@/lib/verifyDomain';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  const domainError = verifyDomain(req);
  if (domainError) return domainError;

  const parsed = await safeParseBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const { phone, otp } = parsed.data;

  if (!phone) return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 });
  if (!otp) return NextResponse.json({ success: false, error: 'OTP is required' }, { status: 400 });
  if (!/^\d{4}$/.test(String(otp))) return NextResponse.json({ success: false, error: 'OTP must be a 4-digit number' }, { status: 400 });

  const normalizedPhone = normalizePhone(String(phone));
  if (!PHONE_REGEX.test(normalizedPhone)) {
    return NextResponse.json({ success: false, error: 'Invalid phone number' }, { status: 400 });
  }

  const record = globalThis.otpStore?.[normalizedPhone];

  if (!record) {
    return NextResponse.json({ success: false, error: 'OTP not sent or already used' }, { status: 400 });
  }

  if (Date.now() - record.created > OTP_EXPIRY_MS) {
    delete globalThis.otpStore![normalizedPhone];
    return NextResponse.json({ success: false, error: 'OTP has expired, please request a new one' }, { status: 400 });
  }

  if (record.otp !== String(otp)) {
    return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
  }

  delete globalThis.otpStore![normalizedPhone];
  return NextResponse.json({ success: true, message: 'OTP verified successfully' });
}
