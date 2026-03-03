import { Response } from 'express';
import Review from '../models/reviewModel';
import Activity from '../models/activityModel';
import User from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';

// Créer un avis
export const createReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { activityId, activityRating, creatorRating, wasPresent, comment } = req.body;

    // Validation
    if (!activityId || !activityRating || !creatorRating || wasPresent === undefined) {
      res.status(400).json({ message: 'Champs obligatoires manquants' });
      return;
    }

    // Vérifier que l'activité existe et est terminée
    const activity = await Activity.findById(activityId);
    if (!activity) {
      res.status(404).json({ message: 'Activité non trouvée' });
      return;
    }

    if (activity.status !== 'completed') {
      res.status(400).json({ message: 'L\'activité n\'est pas encore terminée' });
      return;
    }

    // Vérifier que l'utilisateur a participé à l'activité
    if (!activity.participants.includes(req.userId as any)) {
      res.status(403).json({ message: 'Vous n\'avez pas participé à cette activité' });
      return;
    }

    // Vérifier que l'utilisateur n'a pas déjà noté cette activité
    const existingReview = await Review.findOne({
      activity: activityId,
      reviewer: req.userId,
    });

    if (existingReview) {
      res.status(400).json({ message: 'Vous avez déjà noté cette activité' });
      return;
    }

    // Créer l'avis
    const review = await Review.create({
      activity: activityId,
      reviewer: req.userId,
      reviewee: activity.createdBy,
      activityRating,
      creatorRating,
      wasPresent,
      comment,
    });

    // Mettre à jour les statistiques du créateur
    await updateUserReputation(activity.createdBy.toString());

    // Mettre à jour les statistiques du participant (présence)
    await updateUserAttendance(req.userId!, wasPresent);

    const populatedReview = await Review.findById(review._id)
      .populate('reviewer', 'name avatar')
      .populate('reviewee', 'name avatar');

    res.status(201).json(populatedReview);
  } catch (error: any) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'avis' });
  }
};

// Récupérer les avis d'une activité
export const getActivityReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ activity: req.params.activityId })
      .populate('reviewer', 'name avatar')
      .populate('reviewee', 'name avatar')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error('Get activity reviews error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des avis' });
  }
};

// Vérifier si l'utilisateur a déjà noté une activité
export const checkUserReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await Review.findOne({
      activity: req.params.activityId,
      reviewer: req.userId,
    });

    res.json({ hasReviewed: !!review, review });
  } catch (error) {
    console.error('Check user review error:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
};

// Récupérer les activités en attente d'avis pour un utilisateur
export const getPendingReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Récupérer toutes les activités complétées auxquelles l'utilisateur a participé
    const completedActivities = await Activity.find({
      participants: req.userId,
      status: 'completed',
    })
      .populate('createdBy', 'name avatar')
      .sort({ date: -1 });

    // Récupérer les avis déjà faits par l'utilisateur
    const existingReviews = await Review.find({
      reviewer: req.userId,
      activity: { $in: completedActivities.map(a => a._id) },
    });

    const reviewedActivityIds = new Set(existingReviews.map(r => r.activity.toString()));

    // Filtrer les activités non encore notées
    const pendingActivities = completedActivities.filter(
      activity => !reviewedActivityIds.has(activity._id.toString())
    );

    res.json(pendingActivities);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des activités en attente' });
  }
};

// Fonction helper pour mettre à jour la réputation d'un utilisateur
async function updateUserReputation(userId: string): Promise<void> {
  try {
    // Récupérer tous les avis reçus par l'utilisateur
    const reviews = await Review.find({ reviewee: userId });

    if (reviews.length === 0) return;

    // Calculer la note moyenne
    const totalRating = reviews.reduce((sum, review) => sum + review.creatorRating, 0);
    const averageRating = totalRating / reviews.length;

    // Compter les activités créées
    const activitiesCreated = await Activity.countDocuments({ createdBy: userId });

    // Mettre à jour l'utilisateur
    await User.findByIdAndUpdate(userId, {
      'reputation.averageRating': Math.round(averageRating * 10) / 10,
      'reputation.totalReviews': reviews.length,
      'reputation.activitiesCreated': activitiesCreated,
    });
  } catch (error) {
    console.error('Error updating user reputation:', error);
  }
}

// Fonction helper pour mettre à jour le taux de présence
async function updateUserAttendance(userId: string, wasPresent: boolean): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Récupérer tous les avis où l'utilisateur est le reviewer (ses participations)
    const userReviews = await Review.find({ reviewer: userId });

    const totalActivities = userReviews.length;
    const presentCount = userReviews.filter(r => r.wasPresent).length;
    const noShowCount = totalActivities - presentCount;

    const attendanceRate = totalActivities > 0 
      ? Math.round((presentCount / totalActivities) * 100) 
      : 100;

    // Compter les activités complétées (où l'utilisateur était présent)
    const activitiesCompleted = presentCount;

    await User.findByIdAndUpdate(userId, {
      'reputation.activitiesCompleted': activitiesCompleted,
      'reputation.attendanceRate': attendanceRate,
      'reputation.totalNoShows': noShowCount,
    });
  } catch (error) {
    console.error('Error updating user attendance:', error);
  }
}
