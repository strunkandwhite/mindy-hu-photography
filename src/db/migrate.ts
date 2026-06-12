import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./client";

migrate(db, { migrationsFolder: "drizzle" })
  .then(() => {
    console.log("Migrations applied.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
