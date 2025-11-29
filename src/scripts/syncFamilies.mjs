import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const ZECAT_API = process.env.ZECAT_BASE;
const ZECAT_TOKEN = process.env.ZECAT_TOKEN; // Bearer real

const FamilySchema = new mongoose.Schema({
  id: { type: String, index: true, unique: true },
  title: String,
  slug: String,
  description: String,
  icon_url: String,
  show: Boolean,
  updatedAt: { type: Date, default: Date.now },
}, { collection: "families" });

const Family = mongoose.models.Family || mongoose.model("Family", FamilySchema);

const hideFamily = (s = "") => {
  const n = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sl = n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (
    n.includes("logo 24") ||
    n.includes("logo24") ||
    sl === "logo-24" ||
    sl === "logo-24hs" ||
    sl.startsWith("logo-24")
  );
};

async function main() {
  if (!MONGODB_URI || !ZECAT_TOKEN) throw new Error("Faltan envs");
  await mongoose.connect(MONGODB_URI);

  const res = await fetch(ZECAT_API, {
    headers: { Authorization: `Bearer ${ZECAT_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Zecat HTTP ${res.status}`);
  const data = await res.json(); // { families: [...] } o lista directa

  const families = Array.isArray(data?.families) ? data.families : (Array.isArray(data) ? data : []);
  const actives = families.filter(f => f?.show === true && !hideFamily(f?.title || f?.slug || ""));

  for (const f of actives) {
    await Family.updateOne(
      { id: String(f.id ?? f._id ?? f.slug ?? f.title) },
      {
        $set: {
          title: f.title ?? f.name ?? "",
          slug: f.slug ?? (f.title||"").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
          description: f.description ?? "",
          icon_url: f.icon_url ?? "",
          show: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  // opcional: desactivar las que ya no vienen
  const keepIds = actives.map(f => String(f.id ?? f._id ?? f.slug ?? f.title));
  await Family.updateMany({ id: { $nin: keepIds } }, { $set: { show: false, updatedAt: new Date() } });

  console.log(`Sync familias: ${actives.length} activas`);
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
