import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyRequestAuth } from "@/lib/server/auth";

/**
 * Issues short-lived Vercel Blob client-upload tokens for product photos (free-plan image storage).
 * Only signed-in farmers get a token, only for their own `products/<uid>/` folder, only for JPEG/PNG/WebP
 * up to 5 MB. BLOB_READ_WRITE_TOKEN stays on the server.
 */
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  if (body.type !== "blob.generate-client-token") return Response.json({ error: "Unsupported request." }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Image storage is not configured." }, { status: 503 });

  const auth = await verifyRequestAuth(request);
  if (!auth || auth === "invalid" || auth.token.role !== "farmer") return Response.json({ error: "Only signed-in farmers can upload photos." }, { status: 401 });

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^products\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,60}$/.test(pathname) || !pathname.startsWith(`products/${auth.uid}/`)) {
          throw new Error("Photos must be uploaded to your own product folder.");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 10 * 60_000,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload could not be authorised." }, { status: 400 });
  }
}
