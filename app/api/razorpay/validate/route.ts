import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { safeParseBody, verifyDomain } from '@/lib/verifyDomain';

export async function POST(req: NextRequest) {
  const domainError = verifyDomain(req);
  if (domainError) return domainError;

  try {
    const parsed = await safeParseBody(req);
    if (parsed instanceof NextResponse) return parsed;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
    const key_secret = process.env.RAZORPAY_KEY_SECRET!;
    const generated_signature = crypto
      .createHmac('sha256', key_secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    const isValid = generated_signature === razorpay_signature;
    return NextResponse.json({ success: isValid });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
