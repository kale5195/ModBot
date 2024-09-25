import { ModeratedChannel, Prisma } from "@prisma/client";
import { db } from "~/lib/db.server";
import { Action, Rule } from "~/lib/validations.server";

async function seed() {
  const haole = await db.user.upsert({
    where: {
      id: "3346",
    },
    create: {
      id: "3346",
      name: "haole",
      role: "superadmin",
      plan: "prime",
      avatarUrl: "https://i.imgur.com/hekRUeM.png"
    },
    update: {
      id: "3346",
      role: "superadmin",
      plan: "prime",
    },
  });
}

seed()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
