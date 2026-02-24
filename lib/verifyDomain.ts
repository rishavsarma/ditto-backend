import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN = 'https://buyer.minfy.dev';
export const PHONE_REGEX = /^91[6-9]\d{9}$/;

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 ? '91' + cleaned : cleaned;
}

export async function safeParseBody<T = Record<string, unknown>>(
  req: NextRequest
): Promise<{ data: T } | NextResponse> {
  try {
    const data = (await req.json()) as T;
    return { data };
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid or empty request body. Expected JSON.' },
      { status: 400 }
    );
  }
}

export function verifyDomain(req: NextRequest): NextResponse | null {
  // Skip domain check in development
//   if (process.env.NODE_ENV !== 'production') return null;
return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  const isAllowed =
    origin === ALLOWED_ORIGIN ||
    (referer?.startsWith(ALLOWED_ORIGIN) ?? false);

  if (!isAllowed) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: requests are only allowed from buyer.minfy.dev' },
      { status: 403 }
    );
  }
  return null;
}
