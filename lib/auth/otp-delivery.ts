type DeliveryInput = {
  channel: "EMAIL" | "PHONE";
  identifier: string;
  code: string;
  purpose: "SIGN_IN" | "SIGN_UP";
};

export async function deliverOtp(input: DeliveryInput) {
  if (process.env.NODE_ENV !== "production") {
    return { delivered: true, previewCode: input.code };
  }

  if (input.channel === "EMAIL") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    if (!apiKey || !from) return { delivered: false };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.identifier],
        subject: `${input.code} is your KASA code`,
        html: `<div style="font-family:Arial,sans-serif;padding:32px;color:#17130f"><p style="color:#f45b2a;font-weight:700">KASA — LIFE OS</p><h1 style="font-size:32px;letter-spacing:6px">${input.code}</h1><p>This code expires in 10 minutes. If you did not request it, you can safely ignore this email.</p></div>`,
      }),
    });
    return { delivered: response.ok };
  }

  const webhookUrl = process.env.AUTH_SMS_WEBHOOK_URL;
  const webhookSecret = process.env.AUTH_SMS_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) return { delivered: false };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${webhookSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.identifier,
      code: input.code,
      purpose: input.purpose,
      brand: "KASA",
    }),
  });
  return { delivered: response.ok };
}
