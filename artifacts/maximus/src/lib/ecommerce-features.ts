export const ecommerceFeatureDefinitions = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'vente-physique', label: 'Vente de produits physiques' },
  { id: 'vente-comptoir', label: 'Vente comptoir' },
  { id: 'depenses', label: 'Dépenses' },
  { id: 'investissements', label: 'Investissements' },
  { id: 'vente-numerique', label: 'Vente de produits numériques' },
  { id: 'categories', label: 'Catégories' },
  { id: 'commandes', label: 'Commandes' },
  { id: 'rapport-ventes', label: 'Rapport des ventes' },
  { id: 'clients', label: 'Clients' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'location', label: 'Location' },
  { id: 'livraisons', label: 'Livraisons' },
  { id: 'finances', label: 'Finances & retraits' },
  { id: 'parametres', label: 'Paramètres' },
] as const;

export const ecommerceFeatureDependencies: Partial<Record<string, string[]>> = {
  commandes: ['catalogue'],
  categories: ['catalogue'],
  promotions: ['catalogue'],
  location: ['catalogue'],
  'vente-physique': ['catalogue'],
  'vente-comptoir': ['catalogue', 'vente-physique'],
  'vente-numerique': ['catalogue'],
  livraisons: ['commandes'],
};

export const ecommerceFeaturePacks = [
  {
    id: 'ecommerce-catalogue',
    name: 'Catalogue en ligne',
    description: 'Publier une boutique et présenter vos produits.',
    featureIds: ['dashboard', 'catalogue', 'vente-physique', 'categories', 'finances', 'parametres'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir', 'créer', 'modifier'],
      categories: ['voir', 'créer', 'modifier'],
      finances: ['voir', 'modifier'],
      parametres: ['voir', 'modifier'],
    },
  },
  {
    id: 'ecommerce-gestion',
    name: 'Gestion e-commerce',
    description: 'Piloter le catalogue, les commandes et les clients.',
    featureIds: ['dashboard', 'catalogue', 'vente-physique', 'categories', 'commandes', 'clients', 'finances', 'parametres'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir', 'créer', 'modifier'],
      categories: ['voir', 'créer', 'modifier'],
      commandes: ['voir', 'modifier'],
      clients: ['voir'],
      finances: ['voir', 'modifier'],
      parametres: ['voir', 'modifier'],
    },
  },
  {
    id: 'ecommerce-rapport-ventes',
    name: 'Rapport des ventes',
    description: 'Consulter les ventes des sources activées pour l’entreprise.',
    featureIds: ['rapport-ventes'],
    featurePermissions: {
      'rapport-ventes': ['voir'],
    },
  },
  {
    id: 'ecommerce-depenses',
    name: 'Dépenses',
    description: 'Saisir les investissements et dépenses personnelles, séparément du chiffre d’affaires.',
    featureIds: ['depenses'],
    featurePermissions: {
      depenses: ['voir', 'créer', 'modifier'],
    },
  },
  {
    id: 'ecommerce-investissements',
    name: 'Investissements',
    description: 'Enregistrer et suivre les investissements avec leurs catégories.',
    featureIds: ['investissements'],
    featurePermissions: {
      investissements: ['voir', 'créer', 'modifier'],
    },
  },
  {
    id: 'ecommerce-vente-comptoir',
    name: 'Vente comptoir',
    description: 'Vente comptoir incluse dans le forfait mensuel MAXIMUS via le module E-commerce, sans commission par vente.',
    featureIds: ['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir'],
      'vente-physique': ['voir'],
      'vente-comptoir': ['voir', 'créer'],
    },
  },
  {
    id: 'ecommerce-vente-numerique',
    name: 'Vente de produits numériques',
    description: 'Publier des fichiers numériques et les délivrer après paiement.',
    featureIds: ['dashboard', 'catalogue', 'vente-numerique', 'categories', 'commandes', 'clients', 'finances', 'parametres'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir', 'créer', 'modifier'],
      'vente-numerique': ['voir', 'créer', 'modifier'],
      categories: ['voir', 'créer', 'modifier'],
      commandes: ['voir', 'modifier'],
      clients: ['voir'],
      finances: ['voir', 'modifier'],
      parametres: ['voir', 'modifier'],
    },
  },
  {
    id: 'ecommerce-vente-complete',
    name: 'Ventes physiques et numériques',
    description: 'Vendre les deux types de produits dans la même boutique.',
    featureIds: ['dashboard', 'catalogue', 'vente-physique', 'vente-numerique', 'categories', 'commandes', 'clients', 'finances', 'parametres'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir', 'créer', 'modifier'],
      'vente-physique': ['voir', 'créer', 'modifier'],
      'vente-numerique': ['voir', 'créer', 'modifier'],
      categories: ['voir', 'créer', 'modifier'],
      commandes: ['voir', 'modifier'],
      clients: ['voir'],
      finances: ['voir', 'modifier'],
      parametres: ['voir', 'modifier'],
    },
  },
  {
    id: 'ecommerce-location',
    name: 'Location & réservation',
    description: 'Présenter et gérer les offres de location de maisons, bâches, véhicules et équipements.',
    featureIds: ['dashboard', 'catalogue', 'vente-physique', 'categories', 'location', 'commandes', 'clients', 'parametres'],
    featurePermissions: {
      dashboard: ['voir'],
      catalogue: ['voir', 'créer', 'modifier'],
      'vente-physique': ['voir', 'créer', 'modifier'],
      categories: ['voir', 'créer', 'modifier'],
      location: ['voir', 'créer', 'modifier'],
      commandes: ['voir', 'modifier'],
      clients: ['voir'],
      parametres: ['voir', 'modifier'],
    },
  },
  {
    id: 'ecommerce-supervision',
    name: 'Supervision boutique',
    description: 'Superviser les ventes physiques et numériques, les promotions et les livraisons.',
    featureIds: ecommerceFeatureDefinitions
        .filter(feature => !['vente-comptoir', 'rapport-ventes', 'depenses'].includes(feature.id))
      .map(feature => feature.id),
    featurePermissions: Object.fromEntries(
      ecommerceFeatureDefinitions
        .filter(feature => !['vente-comptoir', 'rapport-ventes', 'depenses'].includes(feature.id))
        .map(feature => [
        feature.id,
        feature.id === 'dashboard' || feature.id === 'clients'
          ? ['voir']
          : ['voir', 'créer', 'modifier'],
        ]),
    ),
  },
] as const;