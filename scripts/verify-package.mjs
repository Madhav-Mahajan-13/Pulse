import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const consumerRoot = await mkdtemp(join(tmpdir(), "nodepulse-consumer-"));

try {
  const packageFilename = runNpm(
    ["pack", "--silent", "--pack-destination", consumerRoot],
    projectRoot,
  )
    .trim()
    .split(/\r?\n/)
    .at(-1);
  if (!packageFilename) throw new Error("npm pack did not return a filename");

  const tarballPath = join(consumerRoot, packageFilename);
  await writeFile(
    join(consumerRoot, "package.json"),
    JSON.stringify({
      name: "nodepulse-consumer-check",
      private: true,
      type: "module",
    }),
  );
  runNpm(
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      tarballPath,
      "express@4.22.2",
      "@types/express@5.0.0",
    ],
    consumerRoot,
  );

  await Promise.all([
    writeFile(
      join(consumerRoot, "consumer.mjs"),
      'import express from "express";\nimport nodepulse from "nodepulse";\nconst app = express();\napp.use(nodepulse({ retentionMinutes: 1 }));\nif (typeof nodepulse !== "function") throw new Error("ESM export is not a function");\n',
    ),
    writeFile(
      join(consumerRoot, "consumer.cjs"),
      'const express = require("express");\nconst nodepulse = require("nodepulse");\nconst app = express();\napp.use(nodepulse({ retentionMinutes: 1 }));\nif (typeof nodepulse !== "function") throw new Error("CJS export is not a function");\n',
    ),
    writeFile(
      join(consumerRoot, "consumer.mts"),
      'import express from "express";\nimport nodepulse from "nodepulse";\nexpress().use(nodepulse({ retentionMinutes: 1 }));\n',
    ),
    writeFile(
      join(consumerRoot, "consumer.cts"),
      'import express = require("express");\nimport nodepulse = require("nodepulse");\nexpress().use(nodepulse({ retentionMinutes: 1 }));\n',
    ),
    writeFile(
      join(consumerRoot, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer.mts", "consumer.cts"],
      }),
    ),
  ]);

  run(process.execPath, ["consumer.mjs"], consumerRoot);
  run(process.execPath, ["consumer.cjs"], consumerRoot);
  run(
    process.execPath,
    [join(projectRoot, "node_modules", "typescript", "bin", "tsc")],
    consumerRoot,
  );

  console.log(
    `Verified ${packageFilename} in isolated ESM, CommonJS, and TypeScript consumers.`,
  );
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}

function runNpm(args, cwd) {
  const npmCliPath = process.env.npm_execpath;
  if (!npmCliPath) throw new Error("npm_execpath is unavailable");
  return run(process.execPath, [npmCliPath, ...args], cwd);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout;
}
