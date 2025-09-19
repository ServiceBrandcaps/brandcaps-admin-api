// app/api/store/families/route.js
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import Product from "@/models/Product";

const cors = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_STORE_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // evita caché de ruta
export function OPTIONS() {
  return NextResponse.json({}, { headers: cors });
}

export async function GET() {
  try {
    await connectDB();

    // dedup por id+title y sólo familias visibles (si tenés "show")
    const families = await Product.aggregate([
      { $unwind: "$families" },
      {
        $group: {
          _id: { id: "$families.id", title: "$families.title" },
          id: { $first: "$families.id" },
          title: { $first: "$families.title" },
          description: { $first: "$families.description" },
          url: { $first: "$families.url" },
          icon_url: {
            $first: {
              $ifNull: ["$families.icon_url", "$families.icon_active_url"],
            },
          },
        },
      },
      { $sort: { title: 1 } },
    ]);
    //console.log(families)
    return NextResponse.json(
      families.map(({ _id, ...rest }) => rest),
      { headers: cors }
    );
  } catch (err) {
    console.error("[/api/store/families] error:", err);
    return NextResponse.json(
      { error: "No se pudieron cargar las categorías" },
      { status: 500 }
    );
  }
}
