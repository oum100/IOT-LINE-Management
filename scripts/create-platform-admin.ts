import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { hashPassword } from "../server/utils/password";
import { prisma } from "../server/utils/prisma";

function isStrongPassword(password: string) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

async function promptHidden(label: string) {
  if (!input.isTTY) {
    throw new Error("Interactive TTY is required to input password.");
  }

  output.write(label);
  let value = "";

  return await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer | string) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;

      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Cancelled by user."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }

        if (char >= " " && char !== "\u007f") {
          value += char;
          output.write("*");
        }
      }
    };

    const cleanup = () => {
      input.off("data", onData);
      if (input.isTTY) {
        input.setRawMode(false);
      }
      input.pause();
    };

    if (input.isTTY) {
      input.setRawMode(true);
    }
    input.resume();
    input.on("data", onData);
  });
}

async function main() {
  const target = (process.argv[2] || "").trim().toLowerCase();
  if (target && target !== "platform") {
    throw new Error("Unsupported target. Use: bun run admin:create platform");
  }

  const rl = createInterface({ input, output });

  try {
    const emailRaw = await rl.question("Platform admin email: ");
    const email = emailRaw.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email format.");
    }

    const nameRaw = await rl.question("Display name [Platform Admin]: ");
    const name = (nameRaw.trim() || "Platform Admin").trim();

    const password = await promptHidden(
      "Password (min 8, 1 uppercase, 1 number, 1 special): "
    );
    if (!isStrongPassword(password)) {
      throw new Error(
        "Password is too weak. Required: 8+ chars, 1 uppercase, 1 number, 1 special."
      );
    }

    const confirmPassword = await promptHidden("Confirm password: ");
    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match.");
    }

    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name,
            passwordHash,
            role: "ADMIN",
            isActive: true,
            emailVerified: new Date(),
          },
          select: { id: true, email: true, role: true, name: true },
        })
      : await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "ADMIN",
            isActive: true,
            emailVerified: new Date(),
          },
          select: { id: true, email: true, role: true, name: true },
        });

    output.write(
      `\nPlatform admin is ready:\n- id: ${user.id}\n- email: ${user.email}\n- role: ${user.role}\n`
    );
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[admin:create-platform] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
