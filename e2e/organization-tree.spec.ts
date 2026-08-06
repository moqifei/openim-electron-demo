import { expect, test } from "@playwright/test";

import { getOrganizationNodeClassName } from "../src/pages/contact/organization/treePresentation";

test("marks organization nodes with and without children", () => {
  expect(getOrganizationNodeClassName({ children: [{ key: "child" }] })).toBe("branch");
  expect(getOrganizationNodeClassName({ children: [] })).toBe("leaf");
  expect(getOrganizationNodeClassName({})).toBe("leaf");
});
