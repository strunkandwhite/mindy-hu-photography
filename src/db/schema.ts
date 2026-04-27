import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const adminUser = sqliteTable("admin_user", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => adminUser.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(),
  siteTitle: text("site_title").notNull(),
  tagline: text("tagline").default("").notNull(),
  aboutText: text("about_text").default("").notNull(),
  aboutImageUrl: text("about_image_url"),
  contactEmail: text("contact_email").default("").notNull(),
  contactFormEnabled: integer("contact_form_enabled").default(1).notNull(),
  socialLinks: text("social_links").default("[]").notNull(),
});

export const galleries = sqliteTable("galleries", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  coverImageId: text("cover_image_id"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isPublished: integer("is_published").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey(),
    galleryId: text("gallery_id").references(() => galleries.id),
    filename: text("filename").notNull(),
    s3Key: text("s3_key").notNull(),
    cdnUrl: text("cdn_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    galleryIdIdx: index("images_gallery_id_idx").on(table.galleryId, table.sortOrder),
  }),
);

export const contactSubmissions = sqliteTable("contact_submissions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  sessionType: text("session_type").notNull(),
  isRead: integer("is_read").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});
