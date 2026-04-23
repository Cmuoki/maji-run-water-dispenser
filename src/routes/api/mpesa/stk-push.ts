import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CONSUMER_KEY = "LlaGAisUgyllJN3u3jfJnWIWGzavg7pJ8zuirp6yHwuSXCgW";
const CONSUMER_SECRET = "GglWXlu0136vbVj2wes44hbqb3NpkGKD6lVCw1EiaeEqmdSNuh1xicupmATtnlLG";
const SHORTCODE = "174379";
const PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

const stkSchema = z.object({
  phone: z.string().regex(/^254\d{9}$/, "Invalid phone"),
  amount: z.number().int().min(1).max(1000),
  litres: z.number().min(0.5).max(5),
});

async function getAccessToken(): Promise<string> {
  const auth = btoa(`${CONSUMER_KEY}:${CONSUMER_SECRET}`);
  const res = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export const Route = createFileRoute("/api/mpesa/stk-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = stkSchema.safeParse(body);

          if (!parsed.success) {
            return new Response(JSON.stringify({ success: false, error: parsed.error.flatten() }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { phone, amount } = parsed.data;
          const token = await getAccessToken();
          const timestamp = getTimestamp();
          const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

          const stkRes = await fetch(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                BusinessShortCode: SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,
                PartyA: phone,
                PartyB: SHORTCODE,
                PhoneNumber: phone,
                CallBackURL: "https://example.com/api/mpesa/callback",
                AccountReference: "MajiRun Water",
                TransactionDesc: "Water purchase",
              }),
            }
          );

          const stkData = await stkRes.json();

          return new Response(
            JSON.stringify({
              success: true,
              data: stkData,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("M-Pesa STK Push error:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
