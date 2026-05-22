export type ProductMode = "lbs" | "contractor";

export const getProductMode = (): ProductMode => {
  const mode = import.meta.env.VITE_PRODUCT_MODE?.trim().toLowerCase();
  if (mode === "contractor") {
    return "contractor";
  }
  return "lbs";
};

export const isLbsMode = () => getProductMode() === "lbs";

export const isContractorMode = () => getProductMode() === "contractor";
