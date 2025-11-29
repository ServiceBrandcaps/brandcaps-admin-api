import crypto from "crypto";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongoose";

const FamilySchema = new mongoose.Schema({
  id: String, title: String, slug: String, description: String, icon_url: String, show: Boolean, updatedAt: Date
}, { collection: "families" });
const Family = mongoose.models.Family || mongoose.model("Family", FamilySchema);

// cache en memoria (proceso) con TTL
let MEMO = { data: null, etag: null, exp: 0 };
const TTL_MS = 5 * 60 * 1000; // 5 min

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const now = Date.now();
    if (MEMO.data && MEMO.exp > now) {
      // Soporte If-None-Match
      const inm = req.headers.get("if-none-match");
      if (inm && MEMO.etag && inm === MEMO.etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: MEMO.etag, "Cache-Control": "public, max-age=60, s-maxage=300" } });
      }
      return NextResponse.json({ success: true, families: MEMO.data }, {
        status: 200,
        headers: { ETag: MEMO.etag, "Cache-Control": "public, max-age=60, s-maxage=300" },
      });
    }

    await connectDB();
    const rows = await Family.find({ show: true }, { _id: 0 }).sort({ title: 1 }).lean();

    const payload = rows.map(r => ({
      id: r.id, title: r.title, slug: r.slug, icon_url: r.icon_url
    }));

    const hash = crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
    const etag = `"fam-${hash}"`;

    MEMO = { data: payload, etag, exp: now + TTL_MS };

    // If-None-Match soporte
    const inm = req.headers.get("if-none-match");
    if (inm && etag && inm === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, max-age=60, s-maxage=300" } });
    }

    return NextResponse.json({ success: true, families: payload }, {
      status: 200,
      headers: { ETag: etag, "Cache-Control": "public, max-age=60, s-maxage=300" }, // 1 min browser, 5 min CDN
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
