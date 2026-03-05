import { describe, expect, it } from "vitest";
import { getHelloMessage } from "./hello";
import { t } from "./i18n/t";

describe("getHelloMessage", () => {
  it("returns the default message", () => {
    expect(getHelloMessage()).toBe(t("app.greeting"));
  });
});
