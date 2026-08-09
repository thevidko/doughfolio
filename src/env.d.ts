/**
 * Ambient module declarations for asset imports handled by Bun's bundler.
 * Importing an image yields its public URL as a string.
 */
declare module "*.png" {
  const url: string;
  export default url;
}

declare module "*.svg" {
  const url: string;
  export default url;
}
