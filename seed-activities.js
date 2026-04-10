require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

// Configuration
const UNSPLASH_ACCESS_KEY = 'ztJ6o16j3rk8qqxhqI6Fyioomalm8VNZZcHmKrxwwFg'; // À remplacer par votre clé Unsplash
const USE_UNSPLASH = true; // Mettre à true si vous avez une clé Unsplash
const NUM_ACTIVITIES = 50; // Nombre d'activités à créer

// Schéma Activity
const activitySchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  tags: [String],
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
    name: String,
    city: String,
  },
  date: Date,
  duration: Number,
  createdBy: mongoose.Schema.Types.ObjectId,
  participants: [mongoose.Schema.Types.ObjectId],
  maxParticipants: Number,
  imageUrl: String,
  status: String,
  groupId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

const Activity = mongoose.model('Activity', activitySchema);
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

// Données de test
const categories = ['sport', 'food', 'culture', 'nightlife', 'outdoor', 'gaming', 'networking', 'other'];

const activityTemplates = {
  sport: [
    { title: 'Match de football', tags: ['football', 'sport', 'équipe'], description: 'Match amical de football au parc' },
    { title: 'Session de yoga', tags: ['yoga', 'bien-être', 'relaxation'], description: 'Séance de yoga en plein air' },
    { title: 'Course à pied', tags: ['running', 'fitness', 'cardio'], description: 'Course matinale de 5km' },
    { title: 'Tennis en double', tags: ['tennis', 'sport', 'raquette'], description: 'Partie de tennis en double' },
    { title: 'Natation', tags: ['natation', 'piscine', 'sport'], description: 'Session de natation à la piscine' },
  ],
  food: [
    { title: 'Brunch du dimanche', tags: ['brunch', 'restaurant', 'convivial'], description: 'Brunch entre amis dans un café sympa' },
    { title: 'Cours de cuisine', tags: ['cuisine', 'apprentissage', 'gastronomie'], description: 'Atelier de cuisine italienne' },
    { title: 'Dégustation de vins', tags: ['vin', 'dégustation', 'œnologie'], description: 'Soirée dégustation de vins' },
    { title: 'Food truck tour', tags: ['street-food', 'découverte', 'cuisine'], description: 'Tour des meilleurs food trucks' },
    { title: 'Pique-nique au parc', tags: ['pique-nique', 'outdoor', 'convivial'], description: 'Pique-nique géant au parc' },
  ],
  culture: [
    { title: 'Visite de musée', tags: ['musée', 'art', 'culture'], description: 'Visite guidée du musée d\'art moderne' },
    { title: 'Soirée théâtre', tags: ['théâtre', 'spectacle', 'culture'], description: 'Pièce de théâtre contemporain' },
    { title: 'Concert de jazz', tags: ['jazz', 'musique', 'concert'], description: 'Concert de jazz dans un club intimiste' },
    { title: 'Exposition photo', tags: ['photographie', 'art', 'exposition'], description: 'Vernissage d\'exposition photo' },
    { title: 'Ciné-club', tags: ['cinéma', 'film', 'discussion'], description: 'Projection et débat autour d\'un film' },
  ],
  nightlife: [
    { title: 'Soirée en club', tags: ['club', 'danse', 'musique'], description: 'Soirée électro dans un club branché' },
    { title: 'Bar à cocktails', tags: ['cocktails', 'bar', 'soirée'], description: 'Découverte d\'un bar à cocktails' },
    { title: 'Karaoké night', tags: ['karaoké', 'chant', 'fun'], description: 'Soirée karaoké entre amis' },
    { title: 'Pub quiz', tags: ['quiz', 'jeux', 'pub'], description: 'Soirée quiz dans un pub irlandais' },
    { title: 'Rooftop party', tags: ['rooftop', 'fête', 'vue'], description: 'Soirée sur un rooftop avec vue' },
  ],
  outdoor: [
    { title: 'Randonnée en montagne', tags: ['randonnée', 'nature', 'montagne'], description: 'Randonnée d\'une journée en montagne' },
    { title: 'Vélo en forêt', tags: ['vélo', 'VTT', 'nature'], description: 'Sortie VTT en forêt' },
    { title: 'Camping weekend', tags: ['camping', 'nature', 'aventure'], description: 'Weekend camping sous les étoiles' },
    { title: 'Escalade outdoor', tags: ['escalade', 'sport', 'nature'], description: 'Session d\'escalade en falaise' },
    { title: 'Kayak sur rivière', tags: ['kayak', 'eau', 'sport'], description: 'Descente en kayak sur la rivière' },
  ],
  gaming: [
    { title: 'Tournoi de jeux vidéo', tags: ['esport', 'compétition', 'gaming'], description: 'Tournoi de jeux vidéo en ligne' },
    { title: 'Soirée jeux de société', tags: ['jeux-de-société', 'convivial', 'stratégie'], description: 'Soirée jeux de plateau' },
    { title: 'LAN party', tags: ['LAN', 'gaming', 'multijoueur'], description: 'LAN party entre gamers' },
    { title: 'Escape game', tags: ['escape-game', 'énigmes', 'équipe'], description: 'Session d\'escape game' },
    { title: 'Réalité virtuelle', tags: ['VR', 'technologie', 'gaming'], description: 'Découverte de la réalité virtuelle' },
  ],
  networking: [
    { title: 'Meetup entrepreneurs', tags: ['entrepreneuriat', 'business', 'networking'], description: 'Rencontre d\'entrepreneurs locaux' },
    { title: 'Conférence tech', tags: ['technologie', 'conférence', 'innovation'], description: 'Conférence sur les nouvelles technologies' },
    { title: 'Afterwork professionnel', tags: ['afterwork', 'networking', 'professionnel'], description: 'Afterwork networking' },
    { title: 'Workshop créatif', tags: ['workshop', 'créativité', 'apprentissage'], description: 'Atelier de créativité et innovation' },
    { title: 'Speed networking', tags: ['networking', 'rencontres', 'professionnel'], description: 'Session de speed networking' },
  ],
  other: [
    { title: 'Atelier DIY', tags: ['DIY', 'créatif', 'manuel'], description: 'Atelier de création DIY' },
    { title: 'Méditation guidée', tags: ['méditation', 'bien-être', 'zen'], description: 'Session de méditation en groupe' },
    { title: 'Club de lecture', tags: ['lecture', 'livres', 'discussion'], description: 'Rencontre du club de lecture' },
    { title: 'Cours de langue', tags: ['langue', 'apprentissage', 'échange'], description: 'Échange linguistique convivial' },
    { title: 'Bénévolat associatif', tags: ['bénévolat', 'solidarité', 'engagement'], description: 'Action bénévole pour une association' },
  ],
};

// Villes sénégalaises avec coordonnées
const cities = [
  { name: 'Dakar', coords: [-17.4467, 14.6928], locations: ['Plateau', 'Corniche', 'Île de Gorée', 'Marché Sandaga', 'Place de l\'Indépendance', 'Almadies'] },
  { name: 'Dakar', coords: [-17.4677, 14.7167], locations: ['Yoff', 'Ngor', 'Ouakam', 'Mamelles', 'Plage de Yoff'] },
  { name: 'Dakar', coords: [-17.4400, 14.6937], locations: ['Médina', 'Grand Dakar', 'HLM', 'Parcelles Assainies'] },
  { name: 'Pikine', coords: [-17.3900, 14.7500], locations: ['Pikine', 'Guédiawaye', 'Thiaroye', 'Diamaguène'] },
  { name: 'Rufisque', coords: [-17.2700, 14.7167], locations: ['Rufisque', 'Bargny', 'Diamniadio'] },
  { name: 'Thiès', coords: [-16.9260, 14.7886], locations: ['Centre-ville Thiès', 'Gare de Thiès', 'Marché Central'] },
  { name: 'Saint-Louis', coords: [-16.4892, 16.0179], locations: ['Île de Saint-Louis', 'Langue de Barbarie', 'Hydrobase'] },
];

// Fonction pour obtenir une image depuis Unsplash
async function getUnsplashImage(category) {
  if (!USE_UNSPLASH || !UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === 'YOUR_UNSPLASH_ACCESS_KEY') {
    return null;
  }

  try {
    const queries = {
      sport: 'sports activity',
      food: 'food restaurant',
      culture: 'museum art culture',
      nightlife: 'nightlife party club',
      outdoor: 'outdoor nature hiking',
      gaming: 'gaming esports',
      networking: 'business meeting networking',
      other: 'people activity',
    };

    const response = await axios.get('https://api.unsplash.com/photos/random', {
      params: {
        query: queries[category] || 'activity',
        orientation: 'landscape',
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });

    return response.data.urls.regular;
  } catch (error) {
    console.log(`Erreur lors de la récupération d'image Unsplash: ${error.message}`);
    return null;
  }
}

// Fonction pour générer une date aléatoire dans les 30 prochains jours
function getRandomFutureDate() {
  const now = new Date();
  const daysToAdd = Math.floor(Math.random() * 30) + 1;
  const hoursToAdd = Math.floor(Math.random() * 24);
  
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + daysToAdd);
  futureDate.setHours(hoursToAdd, 0, 0, 0);
  
  return futureDate;
}

// Fonction pour générer des activités
async function seedActivities() {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');

    // Récupérer un utilisateur existant pour créer les activités
    const users = await User.find().limit(10);
    if (users.length === 0) {
      console.log('❌ Aucun utilisateur trouvé. Créez d\'abord des utilisateurs.');
      process.exit(1);
    }

    console.log(`👥 ${users.length} utilisateurs trouvés`);
    console.log(`🎯 Création de ${NUM_ACTIVITIES} activités...`);

    const activities = [];
    let imageCount = 0;

    for (let i = 0; i < NUM_ACTIVITIES; i++) {
      // Sélectionner une catégorie aléatoire
      const category = categories[Math.floor(Math.random() * categories.length)];
      const templates = activityTemplates[category];
      const template = templates[Math.floor(Math.random() * templates.length)];

      // Sélectionner une ville et un lieu aléatoires
      const city = cities[Math.floor(Math.random() * cities.length)];
      const locationName = city.locations[Math.floor(Math.random() * city.locations.length)];

      // Ajouter une petite variation aux coordonnées
      const coords = [
        city.coords[0] + (Math.random() - 0.5) * 0.1,
        city.coords[1] + (Math.random() - 0.5) * 0.1,
      ];

      // Décider si on ajoute une image (70% de chance)
      const shouldHaveImage = Math.random() > 0.3;
      let imageUrl = null;

      if (shouldHaveImage) {
        imageUrl = await getUnsplashImage(category);
        if (imageUrl) imageCount++;
        
        // Petit délai pour respecter les limites de l'API Unsplash
        if (USE_UNSPLASH && imageUrl) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Sélectionner un créateur aléatoire
      const creator = users[Math.floor(Math.random() * users.length)];

      // Créer l'activité
      const activity = {
        title: `${template.title} #${i + 1}`,
        description: template.description,
        category,
        tags: template.tags,
        location: {
          type: 'Point',
          coordinates: coords,
          name: locationName,
          city: city.name,
        },
        date: getRandomFutureDate(),
        duration: [1, 1.5, 2, 2.5, 3, 4][Math.floor(Math.random() * 6)],
        createdBy: creator._id,
        participants: [],
        maxParticipants: Math.floor(Math.random() * 15) + 5, // Entre 5 et 20
        imageUrl,
        status: 'upcoming',
      };

      activities.push(activity);

      // Afficher la progression
      if ((i + 1) % 10 === 0) {
        console.log(`📝 ${i + 1}/${NUM_ACTIVITIES} activités préparées...`);
      }
    }

    // Insérer toutes les activités
    console.log('💾 Insertion des activités dans la base de données...');
    const result = await Activity.insertMany(activities);

    console.log('\n✅ Seed terminé avec succès !');
    console.log(`📊 Statistiques:`);
    console.log(`   - ${result.length} activités créées`);
    console.log(`   - ${imageCount} activités avec images`);
    console.log(`   - ${result.length - imageCount} activités sans images`);
    
    // Statistiques par catégorie
    const categoryStats = {};
    result.forEach(activity => {
      categoryStats[activity.category] = (categoryStats[activity.category] || 0) + 1;
    });
    
    console.log(`\n📈 Répartition par catégorie:`);
    Object.entries(categoryStats).forEach(([cat, count]) => {
      console.log(`   - ${cat}: ${count} activités`);
    });

    await mongoose.connection.close();
    console.log('\n🔌 Déconnecté de MongoDB');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

// Exécuter le script
seedActivities();
