export const getOrganizationNodeClassName = (node: { children?: unknown[] }) =>
  node.children && node.children.length > 0 ? "branch" : "leaf";
