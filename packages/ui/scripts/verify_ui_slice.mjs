import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.resolve(__dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const includeVisual = process.argv.includes("--with-visual");

const steps = [
  ["typecheck"],
  ["test"],
  ["build"],
  ["test:visual:config"],
];

if (includeVisual) {
  steps.push(["test:visual"]);
  steps.push(["verify:browser"]);
}

for (const step of steps) {
  const label = step.join(" ");
  await new Promise((resolve, reject) => {
    const child = spawn(pnpmCommand, ["run", ...step], {
      cwd: packageDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`verify-ui-slice failed at ${label}`));
    });

    child.on("error", reject);
  });
}

console.log(`ok: verify-ui-slice${includeVisual ? " (+visual)" : ""}`);
