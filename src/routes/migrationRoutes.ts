import { Router, Request, Response } from 'express';
import Activity from '../models/activityModel';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * Endpoint temporaire pour migrer les statuts des activités
 * À supprimer après la migration
 */
router.post('/migrate-activity-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Mettre à jour les activités avec status 'active' vers 'upcoming'
    const result1 = await Activity.updateMany(
      { status: 'active' },
      { $set: { status: 'upcoming' } }
    );

    // Ajouter une durée par défaut de 2h aux activités qui n'en ont pas
    const result2 = await Activity.updateMany(
      { duration: { $exists: false } },
      { $set: { duration: 2 } }
    );

    // Statistiques
    const stats = await Activity.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      message: 'Migration terminée',
      results: {
        statusUpdated: result1.modifiedCount,
        durationAdded: result2.modifiedCount,
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la migration',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
