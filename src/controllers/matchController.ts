import { Response } from 'express';
import User from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';

interface MatchScore {
  userId: string;
  score: number;
  commonInterests: string[];
  commonGoals: string[];
}

export const getSuggestedUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      res.status(404).json({ message: 'Utilisateur non trouvé' });
      return;
    }

    // Récupérer tous les autres utilisateurs
    const allUsers = await User.find({
      _id: { $ne: req.userId },
    }).select('-password');

    // Calculer le score de compatibilité pour chaque utilisateur
    const matches: MatchScore[] = allUsers.map(user => {
      let score = 0;
      const commonInterests: string[] = [];
      const commonGoals: string[] = [];

      // Comparer les centres d'intérêt
      if (currentUser.interests && user.interests) {
        const userInterests = user.interests as string[];
        const currentInterests = currentUser.interests as string[];
        
        userInterests.forEach(interest => {
          if (currentInterests.includes(interest)) {
            commonInterests.push(interest);
          }
        });
      }

      // Comparer les objectifs
      if (currentUser.goals && user.goals) {
        const userGoals = user.goals as string[];
        const currentGoals = currentUser.goals as string[];
        
        userGoals.forEach(goal => {
          if (currentGoals.includes(goal)) {
            commonGoals.push(goal);
          }
        });
      }

      // Calculer le score en pourcentage
      // On considère qu'avoir tous les intérêts et objectifs en commun = 100%
      const totalCurrentInterests = (currentUser.interests as string[] || []).length;
      const totalCurrentGoals = (currentUser.goals as string[] || []).length;
      const totalPossible = totalCurrentInterests + totalCurrentGoals;

      if (totalPossible > 0) {
        // Pondération: 60% pour les intérêts, 40% pour les objectifs
        const interestScore = totalCurrentInterests > 0 
          ? (commonInterests.length / totalCurrentInterests) * 60 
          : 0;
        const goalScore = totalCurrentGoals > 0 
          ? (commonGoals.length / totalCurrentGoals) * 40 
          : 0;
        
        score = Math.round(interestScore + goalScore);
      }

      // Bonus si localisation proche (à implémenter plus tard)
      // if (currentUser.location && user.location) {
      //   const distance = calculateDistance(currentUser.location, user.location);
      //   if (distance < 10) score = Math.min(100, score + 10); // Bonus si < 10km
      // }

      return {
        userId: user._id.toString(),
        score: Math.min(100, score), // S'assurer que le score ne dépasse pas 100
        commonInterests,
        commonGoals,
      };
    });

    // Filtrer les utilisateurs avec au moins 2 intérêts communs OU 1 objectif commun
    const compatibleMatches = matches.filter(match => 
      match.commonInterests.length >= 2 || match.commonGoals.length >= 1
    );

    // Trier par score décroissant
    compatibleMatches.sort((a, b) => b.score - a.score);

    // Limiter à 20 suggestions
    const topMatches = compatibleMatches.slice(0, 20);

    // Récupérer les détails des utilisateurs
    const suggestedUsers = await Promise.all(
      topMatches.map(async (match) => {
        const user = await User.findById(match.userId).select('-password');
        return {
          ...user?.toObject(),
          matchScore: match.score,
          commonInterests: match.commonInterests,
          commonGoals: match.commonGoals,
        };
      })
    );

    res.json({
      suggestions: suggestedUsers,
      total: suggestedUsers.length,
    });
  } catch (error) {
    console.error('Get suggested users error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des suggestions' });
  }
};
