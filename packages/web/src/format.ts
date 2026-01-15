export const SUPPORTED_FORMATS= [
  'avif',
  'jpeg',
  'png',
  'heic',
  'webp',
  'gif'
  ] as const


export type SinterImageFormat = typeof SUPPORTED_FORMATS[keyof typeof SUPPORTED_FORMATS]
