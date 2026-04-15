import { Request, Response } from 'express';

interface AppVersion {
  platform: 'ios' | 'android';
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  releaseNotes: string;
  downloadUrl?: string;
}

// Configuration des versions - À mettre à jour lors de chaque release
const APP_VERSIONS: Record<string, AppVersion> = {
  ios: {
    platform: 'ios',
    latestVersion: '1.0.0',
    minimumVersion: '1.0.0',
    forceUpdate: false,
    releaseNotes: 'Version initiale de Lokky',
    downloadUrl: 'https://apps.apple.com/app/lokky/id123456789', // À remplacer
  },
  android: {
    platform: 'android',
    latestVersion: '1.0.0',
    minimumVersion: '1.0.0',
    forceUpdate: false,
    releaseNotes: 'Version initiale de Lokky',
    downloadUrl: 'https://play.google.com/store/apps/details?id=com.lokky.app', // À remplacer
  },
};

/**
 * Récupère les informations de version pour une plateforme
 */
export const getAppVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const platform = req.query.platform as 'ios' | 'android';
    
    if (!platform || !['ios', 'android'].includes(platform)) {
      res.status(400).json({ 
        message: 'Platform required (ios or android)' 
      });
      return;
    }
    
    const versionInfo = APP_VERSIONS[platform];
    
    if (!versionInfo) {
      res.status(404).json({ 
        message: 'Version info not found for platform' 
      });
      return;
    }
    
    res.json(versionInfo);
  } catch (error) {
    console.error('Get app version error:', error);
    res.status(500).json({ 
      message: 'Erreur serveur' 
    });
  }
};

/**
 * Met à jour les informations de version (admin uniquement)
 * TODO: Ajouter middleware admin
 */
export const updateAppVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, latestVersion, minimumVersion, forceUpdate, releaseNotes, downloadUrl } = req.body;
    
    if (!platform || !['ios', 'android'].includes(platform)) {
      res.status(400).json({ 
        message: 'Invalid platform' 
      });
      return;
    }
    
    if (!latestVersion || !minimumVersion) {
      res.status(400).json({ 
        message: 'latestVersion and minimumVersion are required' 
      });
      return;
    }
    
    // Mettre à jour la configuration
    APP_VERSIONS[platform] = {
      platform: platform as 'ios' | 'android',
      latestVersion,
      minimumVersion,
      forceUpdate: forceUpdate || false,
      releaseNotes: releaseNotes || '',
      downloadUrl: downloadUrl || APP_VERSIONS[platform].downloadUrl,
    };
    
    res.json({ 
      message: 'Version updated successfully',
      version: APP_VERSIONS[platform]
    });
  } catch (error) {
    console.error('Update app version error:', error);
    res.status(500).json({ 
      message: 'Erreur serveur' 
    });
  }
};
