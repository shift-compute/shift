/**
 * Real marks only for the hero tiles. Each file is the owner's own asset,
 * committed under `public/brand`. Add a logo here once its file is in.
 */
export type BrandLogo = {
  id: string;
  label: string;
  src: string;
  /** Scale inside the tile; >1 crops built-in padding off a square icon. */
  zoom?: number;
  /** Inset for marks drawn on their own field, so they sit on the tile's white. */
  pad?: string;
};

export const ZERO_G_LOGO: BrandLogo = { id: "0g", label: "0G", src: "/brand/0g-logo.png" };
export const SHIFT_LOGO: BrandLogo = { id: "shift", label: "Shift", src: "/brand/favicon-512.png", zoom: 1.16 };
export const ENS_LOGO: BrandLogo = { id: "ens", label: "ENS", src: "/brand/ens-logo.png", pad: "20%" };
export const ETHEREUM_LOGO: BrandLogo = { id: "ethereum", label: "Ethereum", src: "/brand/ethereum-logo.png", zoom: 1.25 };
export const ETHGLOBAL_LOGO: BrandLogo = { id: "ethglobal", label: "ETHGlobal", src: "/brand/ethglobal-logo.png", zoom: 1.2 };
