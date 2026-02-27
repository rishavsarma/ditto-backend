import Api from "./Api";

export const saveOtp = (body: any) => {
  const res = Api.post("/otp-verifications", {
    body: body,
  });
  return res;
};

export const verifyOtp = (params: any) => {
  const res = Api.get("/otp-verifications", {
    search: params,
  });
  return res;
};

export const updateOtp = (body: any) => {
  const res = Api.put("/otp-verifications", {
    body: body,
  });
  return res;
};

saveOtp({
  user_id: "9876543210",
  identifier: "9876543210",
  otp_hash: "123456",
  type: "login",
  expires_at: "2026-02-28T05:40:00.000Z",
});
