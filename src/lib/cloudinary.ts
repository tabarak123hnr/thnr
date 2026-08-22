const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export async function uploadImageToCloudinary(
  file: File,
  folder = "tabarak/rooms",
): Promise<string> {
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary is not configured. Check VITE_CLOUDINARY_* in .env");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image must be under 8 MB.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  body.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body },
  );
  const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }
  return data.secure_url;
}

export async function uploadImagesToCloudinary(
  files: File[],
  folder = "tabarak/rooms",
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadImageToCloudinary(file, folder));
  }
  return urls;
}
