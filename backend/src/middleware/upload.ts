import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Configure multer for avatar uploads
const avatarStorage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos de imagem são permitidos!'));
  }
};

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware to process avatar image
export const processAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado'
      });
    }

    // Generate filename
    const filename = `avatar_${userId}_${Date.now()}.jpg`;
    const filepath = path.join(avatarsDir, filename);

    // Process image with Sharp
    await sharp(req.file.buffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 90,
        progressive: true
      })
      .toFile(filepath);

    // Add processed file info to request
    req.processedFile = {
      filename,
      path: filepath,
      url: `/uploads/avatars/${filename}`
    };

    next();
  } catch (error) {
    console.error('Error processing avatar:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao processar imagem'
    });
  }
};

// Cleanup old avatar file
export const cleanupOldAvatar = (avatarUrl: string | null) => {
  if (!avatarUrl) return;

  try {
    const filename = path.basename(avatarUrl);
    const filepath = path.join(avatarsDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (error) {
    console.error('Error cleaning up old avatar:', error);
  }
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      processedFile?: {
        filename: string;
        path: string;
        url: string;
      };
    }
  }
}