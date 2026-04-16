import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { prisma } from "../server/utils/prisma";

async function main() {
  const rl = createInterface({ input, output });

  try {
    const emailRaw = await rl.question("Admin email to delete: ");
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      throw new Error("Email is required.");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    if (String(user.role).toUpperCase() !== "ADMIN") {
      throw new Error("Target user is not ADMIN.");
    }

    output.write(
      `\nFound admin:\n- id: ${user.id}\n- email: ${user.email}\n- name: ${user.name || "-"}\n- role: ${user.role}\n`
    );
    const confirm = await rl.question('Type "DELETE" to confirm: ');

    if (confirm.trim() !== "DELETE") {
      output.write("Cancelled.\n");
      return;
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    output.write(`Deleted admin: ${user.email}\n`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[admin:delete] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
