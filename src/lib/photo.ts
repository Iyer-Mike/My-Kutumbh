// Phones take 12 MP photos; the server only needs enough to read text.
const MAX_EDGE = 2000;

export async function readBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

/**
 * A face, taken from the middle of the picture and squared off, small
 * enough to travel on a village connection — about 30 KB.
 */
export async function toSquareJpeg(file: File, edge = 400): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image can't be read. Please use a JPG or PNG photo.");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.round((bitmap.width - side) / 2);
  const sy = Math.round((bitmap.height - side) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, side, side, 0, 0, edge, edge);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.82),
  );
}

/** A photo, shrunk and re-encoded as JPEG, ready to post. */
export async function toJpegPayload(file: File, maxEdge = MAX_EDGE): Promise<{ base64: string; mediaType: string }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image can't be read. Please use a JPG or PNG photo.");
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.85),
  );
  return { base64: await readBase64(jpeg), mediaType: "image/jpeg" };
}
