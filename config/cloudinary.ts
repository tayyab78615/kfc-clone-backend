import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Trim values to remove hidden \r characters from Windows-style .env files
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

if (!cloudName || !apiKey || !apiSecret) {
  console.error(
    "[Cloudinary] Missing env vars:",
    { cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret },
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "kfc-menu",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  } as any,
});

const upload = multer({ storage });

export { cloudinary, upload };
