import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImage = async (file: string): Promise<string> => {
  try {

    
    
    const result = await cloudinary.uploader.upload(file, {
      folder: 'lokky',
      timeout: 60000, // 60 secondes
    });
    
    
    return result.secure_url;
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    console.error('Error details:', {
      message: error.message,
      http_code: error.http_code,
      name: error.name
    });
    throw error;
  }
};

export const deleteImage = async (publicId: string): Promise<void> => {
  await cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
