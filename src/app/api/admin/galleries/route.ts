import { validateSession } from "@/lib/auth";
import { db } from "@/db/client";
import { galleries } from "@/db/schema";
import { eq, max } from "drizzle-orm";
import { slugify } from "@/lib/slugify";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, description } = body;
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // Generate slug and check uniqueness
  let slug = slugify(title);

  const existing = await db
    .select({ id: galleries.id })
    .from(galleries)
    .where(eq(galleries.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    slug = `${slug}-${Date.now()}`;
  }

  // Get next sort order
  const maxSort = await db
    .select({ value: max(galleries.sortOrder) })
    .from(galleries);
  const nextSortOrder = (maxSort[0]?.value ?? -1) + 1;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const record = {
    id,
    title,
    slug,
    description: description ?? null,
    sortOrder: nextSortOrder,
    isPublished: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(galleries).values(record);

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json(record, { status: 201 });
}

export async function PUT(request: Request) {
  const sessionId = await validateSession(request);
  if (!sessionId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { order?: { id: string; sortOrder: number }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { order } = body;
  if (!order || !Array.isArray(order)) {
    return Response.json(
      { error: "order array is required" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();

  await Promise.all(
    order.map((item) =>
      db
        .update(galleries)
        .set({ sortOrder: item.sortOrder, updatedAt: now })
        .where(eq(galleries.id, item.id))
    )
  );

  revalidatePath("/galleries");
  revalidatePath("/portfolio/[slug]", "page");

  return Response.json({ success: true });
}
