import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "4000", 10),

  databaseUrl: required("DATABASE_URL", "postgresql://localhost:5432/bluerock_rcm"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? "30d",
  },

  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? "",
    fromName: process.env.EMAIL_FROM_NAME ?? "BlueRock RCM",
  },

  scheduler: {
    cron: process.env.SCHEDULER_CRON ?? "* * * * *",
    enabled: (process.env.ENABLE_SCHEDULER ?? "true").toLowerCase() !== "false",
  },

  agedLeadDays: parseInt(process.env.AGED_LEAD_DAYS ?? "60", 10),
};
