import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function safeName(name) {
  return (name || 'file').replace(/[^\w.\-]/g, '_');
}

export async function uploadBufferToCloudinary(buffer, filename, folder = process.env.CLOUDINARY_FOLDER || 'uploads') {
  const publicId = safeName(filename).replace(/\.[^.]+$/, ''); // sin extensión
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: `${Date.now()}-${publicId}`, resource_type: 'image' },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url); // devuelve URL https
      }
    );
    stream.end(buffer);
  });
}
