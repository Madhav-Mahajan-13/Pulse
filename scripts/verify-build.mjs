import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esmFactory = (await import("../dist/index.js")).default;
const commonJsFactory = require("../compat/index.cjs");

if (typeof esmFactory !== "function") {
  throw new TypeError("ESM build does not expose a default middleware factory");
}
if (typeof commonJsFactory !== "function") {
  throw new TypeError(
    "CommonJS build does not return the middleware factory directly",
  );
}

console.log("Verified direct ESM and CommonJS middleware factory exports.");
