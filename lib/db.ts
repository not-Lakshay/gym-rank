import { neon } from "@neondatabase/serverless";

// One shared client. The Neon serverless driver talks over HTTP rather than
// holding a TCP connection, which is what you want on Vercel where every
// request runs in its own short-lived function.
export const sql = neon(process.env.DATABASE_URL!);
