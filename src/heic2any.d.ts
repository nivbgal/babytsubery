declare module "heic2any" {
  interface HeicConversionOptions {
    blob: Blob;
    toType?: "image/jpeg" | "image/png" | "image/gif";
    quality?: number;
  }

  type HeicConversionResult = Blob | Blob[];

  const heic2any: (options: HeicConversionOptions) => Promise<HeicConversionResult>;
  export default heic2any;
}
