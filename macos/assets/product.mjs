import fs from "node:fs/promises";

const product = JSON.parse(
  await fs.readFile(new URL("./product.json", import.meta.url), "utf8"),
);

export const PRODUCT_NAME = product.displayName;
export const PRODUCT_STUDIO_NAME = product.studioName;
export const PRODUCT_PACKAGE_STEM = product.packageStem;
export const PRODUCT_PUBLISHER = product.publisher;
