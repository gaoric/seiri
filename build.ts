import tailwind from "bun-plugin-tailwind";
import { rm } from "node:fs/promises";

await rm("./dist", { recursive: true, force: true });

const client = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist/client",
  target: "browser",
  minify: true,
  sourcemap: "linked",
  plugins: [tailwind],
});

const worker = await Bun.build({
  entrypoints: ["./worker/index.ts"],
  outdir: "./dist/server",
  target: "browser",
  minify: true,
});

for (const result of [client, worker]) {
  if (result.success) continue;
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(
  `Built ${client.outputs.length} client assets and ${worker.outputs.length} worker entrypoint.`,
);
