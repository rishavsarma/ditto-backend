export {};

declare global {
  // eslint-disable-next-line no-var
  var otpStore: Record<string, { otp: string; created: number }> | undefined;
}
