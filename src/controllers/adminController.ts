import { Request, Response } from 'express';
import User from '../models/userModel';
import Activity from '../models/activityModel';
import Report from '../models/reportModel';
import { 
  sendSuspensionNotification, 
  sendBanNotification, 
  sendReactivationNotification,
  sendAdminWarningNotification,
  sendCustomAdminNotification
} from '../services/notificationService';
import {
  emitUserBanned,
  emitUserSuspended,
  emitUserReactivated,
  emitUserWarned,
} from '../socket/moderationSocket';

// Obtenir les statistiques du dashboard
export const getStats = async (req: Request, res: Response) => {
  try {
    // Compter les utilisateurs
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      'moderation.status': 'active',
    });

    // Compter les activités
    const totalActivities = await Activity.countDocuments();
    const activeActivities = await Activity.countDocuments({
      status: { $in: ['upcoming', 'active', 'ongoing'] },
    });

    // Compter les signalements
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({
      status: 'pending',
    });

    res.json({
      totalUsers,
      activeUsers,
      totalActivities,
      activeActivities,
      totalReports,
      pendingReports,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};

// Obtenir tous les utilisateurs avec pagination
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
};

// Obtenir toutes les activités avec pagination
export const getActivities = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const status = req.query.status as string;

    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const activities = await Activity.find(query)
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Activity.countDocuments(query);

    // Récupérer manuellement les participants pour chaque activité
    const formattedActivities = await Promise.all(
      activities.map(async (activity: any) => {
        const participantIds = Array.isArray(activity.participants) ? activity.participants : [];
        
        // Récupérer les informations des participants
        const participantsData = await User.find({
          _id: { $in: participantIds }
        }).select('name email avatar').lean();

        const participantsCount = participantsData.length;
        
        return {
          ...activity,
          participants: participantsData, // Remplacer les IDs par les objets complets
          participantsCount,
          totalParticipants: participantsCount, // Le créateur est déjà dans participants
        };
      })
    );

    console.log('📊 Sample formatted activity:', JSON.stringify(formattedActivities[0], null, 2));

    res.json(formattedActivities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités' });
  }
};

// Obtenir tous les signalements avec pagination
export const getReports = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const reports = await Report.find(query)
      .populate('reporter', 'name email avatar')
      .populate('reportedUser', 'name email avatar')
      .populate('reportedActivity', 'title')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des signalements' });
  }
};

// Suspendre un utilisateur
export const suspendUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { duration = 7, reason = 'Violation des conditions d\'utilisation' } = req.body; // duration en jours

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + duration);

    user.moderation = {
      status: 'suspended',
      suspendedUntil,
      warningCount: user.moderation?.warningCount || 0,
      reportCount: user.moderation?.reportCount || 0,
      lastWarningAt: user.moderation?.lastWarningAt,
    };

    await user.save();

    // Émettre l'événement socket
    emitUserSuspended(userId, reason, suspendedUntil);

    // Toujours envoyer la notification (push + in-app)
    await sendSuspensionNotification(
      user.pushToken || '', 
      reason, 
      `${duration} jours`, 
      user._id
    );

    res.json({ message: 'Utilisateur suspendu avec succès', user });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ message: 'Erreur lors de la suspension de l\'utilisateur' });
  }
};

// Bannir un utilisateur
export const banUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason = 'Violation grave des conditions d\'utilisation' } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    user.moderation = {
      status: 'banned',
      warningCount: user.moderation?.warningCount || 0,
      reportCount: user.moderation?.reportCount || 0,
      suspendedUntil: user.moderation?.suspendedUntil,
      lastWarningAt: user.moderation?.lastWarningAt,
    };

    await user.save();

    // Émettre l'événement socket
    emitUserBanned(userId, reason);

    // Toujours envoyer la notification (push + in-app)
    await sendBanNotification(user.pushToken || '', reason, user._id);

    res.json({ message: 'Utilisateur banni avec succès', user });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Erreur lors du bannissement de l\'utilisateur' });
  }
};

// Réactiver un utilisateur
export const reactivateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    user.moderation = {
      status: 'active',
      suspendedUntil: undefined,
      warningCount: user.moderation?.warningCount || 0,
      reportCount: user.moderation?.reportCount || 0,
      lastWarningAt: user.moderation?.lastWarningAt,
    };

    await user.save();

    // Émettre l'événement socket
    emitUserReactivated(userId);

    // Toujours envoyer la notification (push + in-app)
    await sendReactivationNotification(user.pushToken || '', user._id);

    res.json({ message: 'Utilisateur réactivé avec succès', user });
  } catch (error) {
    console.error('Reactivate user error:', error);
    res.status(500).json({ message: 'Erreur lors de la réactivation de l\'utilisateur' });
  }
};

// Supprimer une activité
export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findByIdAndDelete(activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activité non trouvée' });
    }

    res.json({ message: 'Activité supprimée avec succès' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'activité' });
  }
};

// Traiter un signalement
export const processReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, action, reason } = req.body; // status: 'reviewed' | 'resolved', action: 'warn' | 'suspend' | 'ban' | 'dismiss' | 'content_removed'

    const report = await Report.findById(reportId)
      .populate('reportedUser', 'name email pushToken')
      .populate('reportedActivity', 'title createdBy');
    
    if (!report) {
      return res.status(404).json({ message: 'Signalement non trouvé' });
    }

    report.status = status;
    report.action = action;
    await report.save();

    // Traiter selon le type de signalement
    if (report.reportType === 'user' && report.reportedUser) {
      // Signalement d'utilisateur
      if (action !== 'dismiss' && action !== 'none') {
        const user = await User.findById(report.reportedUser);
        if (user) {
          if (action === 'warn' || action === 'warning') {
            user.moderation = {
              status: 'warned',
              warningCount: (user.moderation?.warningCount || 0) + 1,
              reportCount: user.moderation?.reportCount || 0,
              lastWarningAt: new Date(),
              suspendedUntil: user.moderation?.suspendedUntil,
            };
            await user.save();

            // Envoyer notification d'avertissement
            if (user.pushToken) {
              await sendAdminWarningNotification(
                user.pushToken,
                reason || report.reason,
                user._id
              );
            }
          } else if (action === 'suspend' || action === 'user_suspended') {
            const suspendedUntil = new Date();
            suspendedUntil.setDate(suspendedUntil.getDate() + 7); // 7 jours
            user.moderation = {
              status: 'suspended',
              suspendedUntil,
              warningCount: user.moderation?.warningCount || 0,
              reportCount: user.moderation?.reportCount || 0,
              lastWarningAt: user.moderation?.lastWarningAt,
            };
            await user.save();

            // Envoyer notification de suspension
            if (user.pushToken) {
              await sendSuspensionNotification(
                user.pushToken,
                reason || report.reason,
                '7 jours',
                user._id
              );
            }
          } else if (action === 'ban' || action === 'user_banned') {
            user.moderation = {
              status: 'banned',
              warningCount: user.moderation?.warningCount || 0,
              reportCount: user.moderation?.reportCount || 0,
              suspendedUntil: user.moderation?.suspendedUntil,
              lastWarningAt: user.moderation?.lastWarningAt,
            };
            await user.save();

            // Envoyer notification de bannissement
            if (user.pushToken) {
              await sendBanNotification(
                user.pushToken,
                reason || report.reason,
                user._id
              );
            }
          }
        }
      }
    } else if (report.reportType === 'activity' && report.reportedActivity) {
      // Signalement d'activité
      const Activity = (await import('../models/activityModel')).default;
      const activity: any = await Activity.findById(report.reportedActivity._id || report.reportedActivity)
        .populate('createdBy', 'name email pushToken');
      
      if (activity) {
        if (action === 'content_removed') {
          // Supprimer l'activité
          await Activity.findByIdAndDelete(activity._id);

          // Envoyer notification au créateur
          if (activity.createdBy) {
            const creatorPushToken = typeof activity.createdBy === 'object' ? activity.createdBy.pushToken : '';
            const creatorId = typeof activity.createdBy === 'object' ? activity.createdBy._id : activity.createdBy;
            
            await sendCustomAdminNotification(
              creatorPushToken || '',
              '🚫 Activité supprimée',
              `Votre activité "${activity.title}" a été supprimée pour violation des règles. Raison : ${reason || report.reason}`,
              creatorId
            );
          }
        } else if (action === 'warn' || action === 'warning') {
          // Avertir le créateur sans supprimer l'activité
          if (activity.createdBy) {
            const creatorPushToken = typeof activity.createdBy === 'object' ? activity.createdBy.pushToken : '';
            const creatorId = typeof activity.createdBy === 'object' ? activity.createdBy._id : activity.createdBy;
            
            await sendCustomAdminNotification(
              creatorPushToken || '',
              '⚠️ Avertissement concernant votre activité',
              `Votre activité "${activity.title}" a été signalée. Raison : ${reason || report.reason}. Veuillez respecter les règles de la communauté.`,
              creatorId
            );
          }
        }
      }
    }

    res.json({ message: 'Signalement traité avec succès', report });
  } catch (error) {
    console.error('Process report error:', error);
    res.status(500).json({ message: 'Erreur lors du traitement du signalement' });
  }
};


// Statistiques hebdomadaires
export const getWeeklyStats = async (req: Request, res: Response) => {
  try {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const weeklyData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const [users, activities, reports] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Activity.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
        Report.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }),
      ]);

      weeklyData.push({
        name: days[date.getDay()],
        users,
        activities,
        reports,
      });
    }

    res.json(weeklyData);
  } catch (error) {
    console.error('Get weekly stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques hebdomadaires' });
  }
};

// Statistiques mensuelles
export const getMonthlyStats = async (req: Request, res: Response) => {
  try {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const monthlyData = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setMonth(nextDate.getMonth() + 1);

      const users = await User.countDocuments({ 
        createdAt: { $gte: date, $lt: nextDate } 
      });

      monthlyData.push({
        month: months[date.getMonth()],
        value: users,
      });
    }

    res.json(monthlyData);
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques mensuelles' });
  }
};

// Statistiques par catégorie
export const getCategoryStats = async (req: Request, res: Response) => {
  try {
    const categories = await Activity.aggregate([
      {
        $group: {
          _id: '$category',
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1,
        },
      },
      {
        $sort: { value: -1 },
      },
    ]);

    res.json(categories);
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques par catégorie' });
  }
};

// Statistiques géographiques
export const getGeographicStats = async (req: Request, res: Response) => {
  try {
    const users = await User.find(
      { 
        location: { $exists: true },
        'moderation.status': 'active'
      },
      { location: 1 }
    );

    const locationMap = new Map<string, { coordinates: number[], count: number }>();

    users.forEach(user => {
      if (user.location && user.location.coordinates) {
        const [lng, lat] = user.location.coordinates;
        const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
        
        if (locationMap.has(key)) {
          const existing = locationMap.get(key)!;
          existing.count++;
        } else {
          locationMap.set(key, {
            coordinates: [lng, lat],
            count: 1,
          });
        }
      }
    });

    const locations = Array.from(locationMap.entries())
      .map(([key, data]) => ({
        coordinates: data.coordinates,
        users: data.count,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 20);

    res.json(locations);
  } catch (error) {
    console.error('Get geographic stats error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques géographiques' });
  }
};

// Top villes avec géocodage inversé
export const getTopCities = async (req: Request, res: Response) => {
  try {
    const users = await User.find(
      { 
        location: { $exists: true },
        'moderation.status': 'active'
      },
      { location: 1, name: 1 }
    );

    console.log(`[TopCities] Found ${users.length} users with location`);

    // Grouper les utilisateurs par zone géographique (arrondi à 0.5 degré)
    const cityMap = new Map<string, { 
      coordinates: [number, number], 
      count: number,
      avgLat: number,
      avgLng: number,
      sumLat: number,
      sumLng: number
    }>();

    users.forEach(user => {
      if (user.location && user.location.coordinates && user.location.coordinates.length === 2) {
        const [lng, lat] = user.location.coordinates;
        
        // Arrondir à 0.5 degré pour grouper les utilisateurs proches
        const roundedLat = Math.round(lat * 2) / 2;
        const roundedLng = Math.round(lng * 2) / 2;
        const key = `${roundedLat},${roundedLng}`;
        
        if (cityMap.has(key)) {
          const existing = cityMap.get(key)!;
          existing.count++;
          existing.sumLat += lat;
          existing.sumLng += lng;
          existing.avgLat = existing.sumLat / existing.count;
          existing.avgLng = existing.sumLng / existing.count;
        } else {
          cityMap.set(key, {
            coordinates: [lng, lat],
            count: 1,
            avgLat: lat,
            avgLng: lng,
            sumLat: lat,
            sumLng: lng,
          });
        }
      }
    });

    console.log(`[TopCities] Grouped into ${cityMap.size} zones`);

    // Convertir en tableau et trier par nombre d'utilisateurs
    const topZones = Array.from(cityMap.entries())
      .map(([key, data]) => ({
        key,
        coordinates: [data.avgLng, data.avgLat] as [number, number],
        users: data.count,
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10);

    // Faire le géocodage inversé pour obtenir les noms de villes
    const topCities = await Promise.all(
      topZones.map(async (zone) => {
        try {
          const [lng, lat] = zone.coordinates;
          
          // Utiliser Nominatim pour le géocodage inversé (gratuit, pas de clé API requise)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'Lokky-Admin-Dashboard/1.0'
              }
            }
          );

          if (response.ok) {
            const data: any = await response.json();
            const address = data.address || {};
            
            // Extraire le nom de la ville (plusieurs possibilités selon le type de lieu)
            const cityName = address.city || 
                           address.town || 
                           address.village || 
                           address.municipality ||
                           address.county ||
                           address.state ||
                           address.country ||
                           `Zone ${zone.key}`;

            console.log(`[TopCities] Geocoded: ${cityName} (${lat}, ${lng})`);

            return {
              name: cityName,
              coordinates: zone.coordinates,
              users: zone.users,
            };
          } else {
            console.warn(`[TopCities] Geocoding failed for ${lat}, ${lng}`);
            return {
              name: `Zone ${zone.key}`,
              coordinates: zone.coordinates,
              users: zone.users,
            };
          }
        } catch (error) {
          console.error(`[TopCities] Geocoding error:`, error);
          return {
            name: `Zone ${zone.key}`,
            coordinates: zone.coordinates,
            users: zone.users,
          };
        }
      })
    );

    console.log('[TopCities] Final cities:', topCities);

    res.json(topCities);
  } catch (error) {
    console.error('Get top cities error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des villes principales' });
  }
};

// Récupérer les activités récentes
export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    // Derniers utilisateurs inscrits
    const recentUsers = await User.find()
      .select('name avatar createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Dernières activités créées
    const recentActivities = await Activity.find()
      .populate('createdBy', 'name avatar')
      .select('title category createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Derniers signalements
    const recentReports = await Report.find()
      .populate('reporter', 'name')
      .populate('reportedUser', 'name')
      .select('reason status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      users: recentUsers.map(user => ({
        id: user._id,
        name: user.name,
        avatar: user.avatar,
        time: user.createdAt,
      })),
      activities: recentActivities.map((activity: any) => ({
        id: activity._id,
        title: activity.title,
        category: activity.category,
        creator: activity.createdBy,
        time: activity.createdAt,
      })),
      reports: recentReports.map((report: any) => ({
        id: report._id,
        reason: report.reason,
        status: report.status,
        reporter: report.reporter,
        reported: report.reportedUser,
        time: report.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer les détails d'une activité
export const getActivityDetails = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findById(activityId)
      .populate('createdBy', 'name avatar email')
      .populate('participants', 'name avatar');

    if (!activity) {
      return res.status(404).json({ message: 'Activité non trouvée' });
    }

    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Envoyer un avertissement à un utilisateur
export const warnUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'La raison de l\'avertissement est requise' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    user.moderation = {
      status: 'warned',
      warningCount: (user.moderation?.warningCount || 0) + 1,
      reportCount: user.moderation?.reportCount || 0,
      lastWarningAt: new Date(),
      suspendedUntil: user.moderation?.suspendedUntil,
    };

    await user.save();

    // Émettre l'événement socket
    emitUserWarned(userId, reason, user.moderation.warningCount);

    // Toujours envoyer la notification (push + in-app)
    await sendAdminWarningNotification(user.pushToken || '', reason, user._id);

    res.json({ message: 'Avertissement envoyé avec succès', user });
  } catch (error) {
    console.error('Warn user error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'avertissement' });
  }
};

// Envoyer une notification personnalisée à un utilisateur
export const sendNotificationToUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Le titre et le message sont requis' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Toujours envoyer la notification (push + in-app)
    await sendCustomAdminNotification(user.pushToken || '', title, message, user._id);
    res.json({ message: 'Notification envoyée avec succès' });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de la notification' });
  }
};

// Métriques de réputation
export const getReputationMetrics = async (req: Request, res: Response) => {
  try {
    const Review = (await import('../models/reviewModel')).default;

    // Vérifier combien de reviews existent
    const totalReviewsCount = await Review.countDocuments();
    console.log('📊 Total reviews in DB:', totalReviewsCount);

    // Afficher quelques reviews pour debug
    const sampleReviews = await Review.find().limit(3).lean();
    console.log('📊 Sample reviews:', JSON.stringify(sampleReviews, null, 2));

    // Top créateurs d'activités (basé sur les activités réelles)
    const topCreators = await Activity.aggregate([
      {
        $group: {
          _id: '$createdBy',
          activitiesCreated: { $sum: 1 },
          completedActivities: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      { $sort: { activitiesCreated: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'reviewee',
          as: 'reviews'
        }
      },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          avatar: '$user.avatar',
          email: '$user.email',
          activitiesCreated: 1,
          completedActivities: 1,
          reviews: 1,
          averageRating: {
            $cond: {
              if: { $gt: [{ $size: '$reviews' }, 0] },
              then: { $avg: '$reviews.creatorRating' },
              else: 0
            }
          },
          totalReviews: { $size: '$reviews' },
          attendanceRate: '$user.reputation.attendanceRate'
        }
      }
    ]);

    console.log('📊 Top creators with reviews:', JSON.stringify(topCreators[0], null, 2));

    // Distribution des notes moyennes (basé sur les reviews réelles)
    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: '$reviewee',
          avgRating: { $avg: '$creatorRating' },
          count: { $sum: 1 }
        }
      },
      {
        $bucket: {
          groupBy: '$avgRating',
          boundaries: [0, 1, 2, 3, 4, 5],
          default: 'other',
          output: {
            count: { $sum: 1 },
            avgReviews: { $avg: '$count' }
          }
        }
      }
    ]);

    // Statistiques globales
    const [activityStats, reviewStats] = await Promise.all([
      Activity.aggregate([
        {
          $group: {
            _id: null,
            totalActivitiesCreated: { $sum: 1 },
            totalActivitiesCompleted: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalActivitiesCancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        }
      ]),
      Review.aggregate([
        {
          $group: {
            _id: null,
            avgActivityRating: { $avg: '$activityRating' },
            avgCreatorRating: { $avg: '$creatorRating' },
            totalReviews: { $sum: 1 },
            presentCount: {
              $sum: { $cond: ['$wasPresent', 1, 0] }
            },
            absentCount: {
              $sum: { $cond: ['$wasPresent', 0, 1] }
            }
          }
        }
      ])
    ]);

    console.log('📊 Review stats:', reviewStats[0]);

    const stats = {
      ...(activityStats[0] || {}),
      ...(reviewStats[0] || {}),
      avgActivityRating: reviewStats[0]?.avgActivityRating || 0,
      avgCreatorRating: reviewStats[0]?.avgCreatorRating || 0,
      totalReviews: reviewStats[0]?.totalReviews || 0,
      presentCount: reviewStats[0]?.presentCount || 0,
      absentCount: reviewStats[0]?.absentCount || 0,
      avgAttendanceRate: reviewStats[0] && reviewStats[0].totalReviews > 0 ? 
        (reviewStats[0].presentCount / reviewStats[0].totalReviews * 100) : 100
    };

    // Utilisateurs avec le plus de no-shows
    const topNoShows = await Review.aggregate([
      { $match: { wasPresent: false } },
      {
        $group: {
          _id: '$reviewer',
          noShowCount: { $sum: 1 }
        }
      },
      { $sort: { noShowCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          avatar: '$user.avatar',
          email: '$user.email',
          noShowCount: 1,
          attendanceRate: '$user.reputation.attendanceRate'
        }
      }
    ]);

    // Derniers avis
    const recentReviews = await Review.find()
      .populate('reviewer', 'name avatar')
      .populate('reviewee', 'name avatar')
      .populate('activity', 'title')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log('📊 Recent reviews count:', recentReviews.length);

    res.json({
      topCreators,
      ratingDistribution,
      stats: stats || {},
      topNoShows,
      recentReviews,
    });
  } catch (error) {
    console.error('Get reputation metrics error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des métriques de réputation' });
  }
};

// Métriques des messages
export const getMessageMetrics = async (req: Request, res: Response) => {
  try {
    const Message = (await import('../models/messageModel')).default;
    const Conversation = (await import('../models/conversationModel')).default;

    // Nombre total de messages
    const totalMessages = await Message.countDocuments();

    // Nombre de conversations actives
    const activeConversations = await Conversation.countDocuments({
      lastMessageAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 derniers jours
    });

    // Messages par jour (7 derniers jours)
    const messagesPerDay = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Utilisateurs les plus actifs en messagerie
    const topMessagers = await Message.aggregate([
      {
        $group: {
          _id: '$sender',
          messageCount: { $sum: 1 }
        }
      },
      { $sort: { messageCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          avatar: '$user.avatar',
          email: '$user.email',
          messageCount: 1
        }
      }
    ]);

    // Messages par heure de la journée
    const messagesByHour = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalMessages,
      activeConversations,
      messagesPerDay,
      topMessagers,
      messagesByHour,
    });
  } catch (error) {
    console.error('Get message metrics error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des métriques de messages' });
  }
};

// Métriques avancées des activités
export const getAdvancedActivityMetrics = async (req: Request, res: Response) => {
  try {
    // Taux de remplissage moyen
    const fillRateStats = await Activity.aggregate([
      {
        $project: {
          fillRate: {
            $multiply: [
              { $divide: [{ $size: '$participants' }, '$maxParticipants'] },
              100
            ]
          },
          status: 1,
          category: 1,
          duration: 1,
          date: 1,
        }
      },
      {
        $group: {
          _id: null,
          avgFillRate: { $avg: '$fillRate' },
          totalActivities: { $sum: 1 },
        }
      }
    ]);

    // Activités par statut
    const activitiesByStatus = await Activity.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Durée moyenne par catégorie
    const avgDurationByCategory = await Activity.aggregate([
      {
        $group: {
          _id: '$category',
          avgDuration: { $avg: '$duration' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Activités par tranche horaire
    const activitiesByTimeSlot = await Activity.aggregate([
      {
        $project: {
          hour: { $hour: '$date' },
          timeSlot: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: ['$hour', 6] }, { $lt: ['$hour', 12] }] }, then: 'Matin (6h-12h)' },
                { case: { $and: [{ $gte: ['$hour', 12] }, { $lt: ['$hour', 18] }] }, then: 'Après-midi (12h-18h)' },
                { case: { $and: [{ $gte: ['$hour', 18] }, { $lt: ['$hour', 24] }] }, then: 'Soir (18h-24h)' },
              ],
              default: 'Nuit (0h-6h)'
            }
          }
        }
      },
      {
        $group: {
          _id: '$timeSlot',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Tags les plus populaires
    const popularTags = await Activity.aggregate([
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Taux de remplissage par catégorie
    const fillRateByCategory = await Activity.aggregate([
      {
        $project: {
          category: 1,
          fillRate: {
            $multiply: [
              { $divide: [{ $size: '$participants' }, '$maxParticipants'] },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: '$category',
          avgFillRate: { $avg: '$fillRate' },
          count: { $sum: 1 }
        }
      },
      { $sort: { avgFillRate: -1 } }
    ]);

    res.json({
      fillRateStats: fillRateStats[0] || { avgFillRate: 0, totalActivities: 0 },
      activitiesByStatus,
      avgDurationByCategory,
      activitiesByTimeSlot,
      popularTags,
      fillRateByCategory,
    });
  } catch (error) {
    console.error('Get advanced activity metrics error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des métriques avancées' });
  }
};
