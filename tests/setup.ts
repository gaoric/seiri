import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  url: "http://localhost/",
});

const { afterEach, expect } = await import("bun:test");
const { cleanup } = await import("@testing-library/react");
const matcherModule = await import("@testing-library/jest-dom/matchers");
const { default: _ignoredDefault, ...matchers } = matcherModule as Record<
  string,
  unknown
>;

expect.extend(matchers as Parameters<typeof expect.extend>[0]);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
