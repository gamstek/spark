import sharp from 'sharp';

export async function compressImage(input: Buffer): Promise<{
  bytes: Buffer;
  extension: 'png' | 'jpg' | 'webp';
  mimeType: string;
}> {
  if (input.length > 5 * 1024 * 1024) throw new Error('MEDIA_TOO_LARGE');
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000 });
    const { format } = await image.metadata();
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp')
      throw new Error('UNSUPPORTED_MEDIA');
    image
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      });
    if (format === 'png')
      image.png({ compressionLevel: 9, palette: true, quality: 90, effort: 7 });
    else if (format === 'jpeg')
      image.jpeg({ quality: 82, mozjpeg: true, progressive: true });
    else image.webp({ quality: 82, alphaQuality: 100, effort: 4 });
    const compressed = await image.toBuffer();
    return {
      bytes: compressed.length < input.length ? compressed : input,
      extension: format === 'jpeg' ? 'jpg' : format,
      mimeType: `image/${format}`,
    };
  } catch {
    throw new Error('UNSUPPORTED_MEDIA');
  }
}
