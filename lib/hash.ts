import bcrypt from "bcrypt";

/**
 * Hashes a plain text OTP.
 * @param otp The plain text OTP
 * @returns The hashed OTP
 */
export async function hashOTP(otp: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(otp, saltRounds);
}

/**
 * Verifies a plain text OTP against a hashed OTP.
 * @param otp The plain text OTP provided by the user
 * @param hashedOtp The hashed OTP stored in the database
 * @returns Boolean indicating whether the OTP is valid
 */
export async function verifyOTP(
  otp: string,
  hashedOtp: string,
): Promise<boolean> {
  if (!hashedOtp) return false;
  return bcrypt.compare(otp, hashedOtp);
}
