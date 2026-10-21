<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ModuleCatalog
{
    public static function definitions(): array
    {
        return [
            [
                'id' => 'commerce',
                'name' => 'Commerce',
                'description' => 'Piloter les ventes, les clients, les achats et la performance commerciale.',
                'features' => ['Clients', 'Devis et commandes', 'Chiffre d’affaires'],
                'feature_packs' => [
                    ['id' => 'commerce-consultation', 'name' => 'Consultation commerciale', 'description' => 'Consulter les clients et le suivi commercial.', 'feature_ids' => ['dashboard', 'clients']],
                    ['id' => 'commerce-gestion', 'name' => 'Gestion commerciale', 'description' => 'Gérer les ventes, clients et indicateurs.', 'feature_ids' => ['dashboard', 'clients', 'sales', 'products', 'reports']],
                    [
                        'id' => 'commerce-employe',
                        'name' => 'Employé commercial',
                        'description' => 'Gérer les clients et suivre les ventes confiées à l’employé.',
                        'feature_ids' => ['dashboard', 'clients', 'sales'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'clients' => ['voir', 'créer', 'modifier'],
                            'sales' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'commerce-manager',
                        'name' => 'Manager commercial',
                        'description' => 'Piloter les ventes, les clients, les produits et les résultats de l’équipe.',
                        'feature_ids' => ['dashboard', 'sales', 'products', 'clients', 'suppliers', 'purchases', 'expenses', 'cash', 'credit', 'invoices', 'returns', 'reports', 'activity'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'sales' => ['voir', 'créer', 'modifier'],
                            'products' => ['voir', 'créer', 'modifier'],
                            'clients' => ['voir', 'créer', 'modifier'],
                            'suppliers' => ['voir', 'créer', 'modifier'],
                            'purchases' => ['voir', 'créer', 'modifier'],
                            'expenses' => ['voir', 'créer', 'modifier'],
                            'cash' => ['voir', 'modifier'],
                            'credit' => ['voir', 'modifier'],
                            'invoices' => ['voir', 'créer', 'modifier'],
                            'returns' => ['voir', 'créer', 'modifier'],
                            'reports' => ['voir'],
                            'activity' => ['voir'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'ecommerce',
                'name' => 'Boutique en ligne',
                'description' => 'Boutique en ligne, catalogue public et commandes clients.',
                'features' => ['Tableau de bord', 'Catalogue', 'Vente physique', 'Vente comptoir', 'Dépenses', 'Investissements', 'Vente numérique', 'Catégories', 'Commandes', 'Rapport des ventes', 'Clients', 'Promotions', 'Location', 'Livraisons', 'Finances', 'Paramètres'],
                'feature_packs' => [
                    ['id' => 'ecommerce-catalogue', 'name' => 'Catalogue en ligne', 'description' => 'Publier une boutique et présenter vos produits.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'categories', 'finances', 'parametres']],
                    ['id' => 'ecommerce-gestion', 'name' => 'Gestion e-commerce', 'description' => 'Piloter le catalogue, les ventes physiques et les clients.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'categories', 'commandes', 'clients', 'finances', 'parametres']],
                    ['id' => 'ecommerce-rapport-ventes', 'name' => 'Rapport des ventes', 'description' => 'Consulter les ventes des sources activées pour l’entreprise.', 'feature_ids' => ['rapport-ventes'], 'feature_permissions' => ['rapport-ventes' => ['voir']]],
                    ['id' => 'ecommerce-depenses', 'name' => 'Dépenses', 'description' => 'Saisir les dépenses personnelles séparément du chiffre d’affaires.', 'feature_ids' => ['depenses'], 'feature_permissions' => ['depenses' => ['voir', 'créer', 'modifier']]],
                    ['id' => 'ecommerce-investissements', 'name' => 'Investissements', 'description' => 'Enregistrer et suivre les investissements avec leurs catégories.', 'feature_ids' => ['investissements'], 'feature_permissions' => ['investissements' => ['voir', 'créer', 'modifier']]],
                    ['id' => 'ecommerce-vente-numerique', 'name' => 'Vente de produits numériques', 'description' => 'Publier des fichiers numériques et les délivrer après paiement.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-numerique', 'categories', 'commandes', 'clients', 'finances', 'parametres']],
                    ['id' => 'ecommerce-vente-complete', 'name' => 'Ventes physiques et numériques', 'description' => 'Vendre des produits physiques et des produits numériques dans la même boutique.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'vente-numerique', 'categories', 'commandes', 'clients', 'finances', 'parametres']],
                    ['id' => 'ecommerce-location', 'name' => 'Location & réservation', 'description' => 'Présenter et gérer les offres de location de maisons, bâches, véhicules et équipements.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'categories', 'location', 'commandes', 'clients', 'parametres']],
                    ['id' => 'ecommerce-supervision', 'name' => 'Supervision boutique', 'description' => 'Superviser les ventes physiques et numériques, les promotions, la location, les livraisons et les retraits.', 'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'vente-numerique', 'categories', 'commandes', 'clients', 'promotions', 'location', 'livraisons', 'finances', 'parametres']],
                    [
                        'id' => 'ecommerce-employe',
                        'name' => 'Employé e-commerce',
                        'description' => 'Traiter les commandes et accompagner les clients sans modifier la configuration de la boutique.',
                        'feature_ids' => ['dashboard', 'commandes', 'clients'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'commandes' => ['voir', 'modifier'],
                            'clients' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'ecommerce-manager',
                        'name' => 'Manager e-commerce',
                        'description' => 'Piloter la boutique, le catalogue, les ventes, les livraisons et les résultats.',
                        'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'vente-numerique', 'categories', 'commandes', 'clients', 'promotions', 'location', 'livraisons', 'finances', 'parametres'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'catalogue' => ['voir', 'créer', 'modifier'],
                            'vente-physique' => ['voir', 'créer', 'modifier'],
                            'vente-numerique' => ['voir', 'créer', 'modifier'],
                            'categories' => ['voir', 'créer', 'modifier'],
                            'commandes' => ['voir', 'créer', 'modifier'],
                            'clients' => ['voir'],
                            'promotions' => ['voir', 'créer', 'modifier'],
                            'location' => ['voir', 'créer', 'modifier'],
                            'livraisons' => ['voir', 'créer', 'modifier'],
                            'finances' => ['voir', 'créer', 'modifier'],
                            'parametres' => ['voir', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'ecommerce-vente-comptoir',
                        'name' => 'Vente comptoir',
                        'description' => 'Vente comptoir incluse dans le forfait mensuel MAXIMUS via le module E-commerce, sans commission par vente.',
                        'feature_ids' => ['dashboard', 'catalogue', 'vente-physique', 'vente-comptoir'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'catalogue' => ['voir'],
                            'vente-physique' => ['voir'],
                            'vente-comptoir' => ['voir', 'créer'],
                        ],
                    ],
                ],
                'feature_dependencies' => [
                    'commandes' => ['catalogue'],
                    'categories' => ['catalogue'],
                    'promotions' => ['catalogue'],
                    'location' => ['catalogue'],
                    'vente-physique' => ['catalogue'],
                    'vente-comptoir' => ['catalogue', 'vente-physique'],
                    'vente-numerique' => ['catalogue'],
                    'livraisons' => ['commandes'],
                ],
            ],
            [
                'id' => 'stocks',
                'name' => 'Gestion de stock',
                'description' => 'Suivre les articles, les entrées, les sorties et les niveaux de stock.',
                'features' => ['Articles', 'Entrées et sorties', 'Alertes de seuil'],
                'feature_packs' => [
                    ['id' => 'stock-consultation', 'name' => 'Consultation du stock', 'description' => 'Consulter les articles et les niveaux de stock.', 'feature_ids' => ['dashboard', 'products', 'reports']],
                    ['id' => 'stock-gestion', 'name' => 'Gestionnaire de stock', 'description' => 'Gérer les entrées, sorties et inventaires.', 'feature_ids' => ['dashboard', 'products', 'entries', 'exits', 'inventory', 'reports']],
                    ['id' => 'stock-responsable', 'name' => 'Responsable de stock', 'description' => 'Piloter les opérations et les paramètres du stock.', 'feature_ids' => ['dashboard', 'products', 'entries', 'exits', 'requests', 'inventory', 'reports', 'references', 'users', 'settings']],
                    [
                        'id' => 'stocks-employe',
                        'name' => 'Employé de stock',
                        'description' => 'Consulter les articles et enregistrer les mouvements de stock autorisés.',
                        'feature_ids' => ['dashboard', 'products', 'entries', 'exits', 'requests'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'products' => ['voir'],
                            'entries' => ['voir', 'créer'],
                            'exits' => ['voir', 'créer'],
                            'requests' => ['voir', 'créer'],
                        ],
                    ],
                    [
                        'id' => 'stocks-manager',
                        'name' => 'Manager de stock',
                        'description' => 'Superviser les mouvements, les inventaires, les référentiels et les utilisateurs du stock.',
                        'feature_ids' => ['dashboard', 'products', 'entries', 'exits', 'requests', 'inventory', 'reports', 'references', 'users', 'settings'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'products' => ['voir', 'créer', 'modifier'],
                            'entries' => ['voir', 'créer', 'modifier'],
                            'exits' => ['voir', 'créer', 'modifier'],
                            'requests' => ['voir', 'créer', 'modifier'],
                            'inventory' => ['voir', 'créer', 'modifier'],
                            'reports' => ['voir'],
                            'references' => ['voir', 'créer', 'modifier'],
                            'users' => ['voir', 'modifier'],
                            'settings' => ['voir', 'modifier'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'presences',
                'name' => 'Présences',
                'description' => 'Présences et suivi quotidien des équipes.',
                'features' => ['Tableau de bord', 'Pointage', 'Présences', 'Absences', 'Horaires', 'Congés', 'Historique', 'Rapports'],
                'feature_packs' => [
                    ['id' => 'presence-consultation', 'name' => 'Consultation des présences', 'description' => 'Consulter les indicateurs, présences, absences et historiques.', 'feature_ids' => ['tableau-de-bord', 'présences', 'absences', 'historique']],
                    ['id' => 'presence-gestion', 'name' => 'Gestionnaire des présences', 'description' => 'Saisir le pointage et gérer les absences, horaires et congés.', 'feature_ids' => ['tableau-de-bord', 'présences', 'absences', 'historique', 'pointage', 'horaires', 'congés']],
                    ['id' => 'presence-supervision', 'name' => 'Responsable des présences', 'description' => 'Superviser l’activité, corriger les données et produire les rapports.', 'feature_ids' => ['tableau-de-bord', 'présences', 'absences', 'historique', 'pointage', 'horaires', 'congés', 'rapports']],
                    [
                        'id' => 'presence-employe',
                        'name' => 'Employé Présences',
                        'description' => 'Pointer, consulter son historique et suivre ses absences et congés.',
                        'feature_ids' => ['tableau-de-bord', 'pointage', 'absences', 'congés', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'pointage' => ['voir', 'créer'],
                            'absences' => ['voir', 'créer'],
                            'congés' => ['voir', 'créer'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'presence-manager',
                        'name' => 'Manager Présences',
                        'description' => 'Piloter les horaires, les absences, les congés et les rapports de l’équipe.',
                        'feature_ids' => ['tableau-de-bord', 'présences', 'absences', 'historique', 'pointage', 'horaires', 'congés', 'rapports'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'présences' => ['voir', 'créer', 'modifier'],
                            'absences' => ['voir', 'créer', 'modifier'],
                            'historique' => ['voir', 'créer', 'modifier'],
                            'pointage' => ['voir', 'créer', 'modifier'],
                            'horaires' => ['voir', 'créer', 'modifier'],
                            'congés' => ['voir', 'créer', 'modifier'],
                            'rapports' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                ],
                'feature_dependencies' => [
                    'présences' => ['pointage'],
                    'rapports' => ['pointage', 'présences'],
                ],
            ],
            [
                'id' => 'paie',
                'name' => 'Paie',
                'description' => 'Enregistrer les bénéficiaires, préparer les salaires et lancer les virements groupés.',
                'features' => ['Tableau de bord', 'Bénéficiaires', 'Préparer une paie', 'Validation', 'Virements', 'Solde de paie', 'Historique'],
                'feature_packs' => [
                    [
                        'id' => 'paie-consultation',
                        'name' => 'Consultation paie',
                        'description' => 'Consulter les bénéficiaires et l’historique des paies.',
                        'feature_ids' => ['tableau-de-bord', 'bénéficiaires', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'bénéficiaires' => ['voir'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'paie-gestion',
                        'name' => 'Gestionnaire de paie',
                        'description' => 'Préparer les paies et gérer les bénéficiaires.',
                        'feature_ids' => ['tableau-de-bord', 'bénéficiaires', 'préparer-une-paie', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'bénéficiaires' => ['voir', 'créer', 'modifier'],
                            'préparer-une-paie' => ['voir', 'créer', 'modifier'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'paie-supervision',
                        'name' => 'Responsable paie',
                        'description' => 'Valider les paies, alimenter le solde et lancer les virements.',
                        'feature_ids' => ['tableau-de-bord', 'bénéficiaires', 'préparer-une-paie', 'validation', 'virements', 'solde-de-paie', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'bénéficiaires' => ['voir', 'créer', 'modifier'],
                            'préparer-une-paie' => ['voir', 'créer', 'modifier'],
                            'validation' => ['voir', 'modifier'],
                            'virements' => ['voir', 'modifier'],
                            'solde-de-paie' => ['voir', 'modifier'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'paie-employe',
                        'name' => 'Employé paie',
                        'description' => 'Consulter les informations et l’historique de paie autorisés.',
                        'feature_ids' => ['tableau-de-bord', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'paie-manager',
                        'name' => 'Manager paie',
                        'description' => 'Superviser la préparation, la validation, le solde et les virements de paie.',
                        'feature_ids' => ['tableau-de-bord', 'bénéficiaires', 'préparer-une-paie', 'validation', 'virements', 'solde-de-paie', 'historique'],
                        'feature_permissions' => [
                            'tableau-de-bord' => ['voir'],
                            'bénéficiaires' => ['voir', 'créer', 'modifier'],
                            'préparer-une-paie' => ['voir', 'créer', 'modifier'],
                            'validation' => ['voir', 'modifier'],
                            'virements' => ['voir', 'modifier'],
                            'solde-de-paie' => ['voir', 'modifier'],
                            'historique' => ['voir'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'transport',
                'name' => 'Transport',
                'description' => 'Organiser les chauffeurs, les véhicules et les courses Taxi.',
                'features' => ['Vue d’ensemble', 'Courses', 'Chauffeurs', 'Véhicules', 'Historique', 'Paramètres'],
                'feature_packs' => [
                    ['id' => 'transport-consultation', 'name' => 'Consultation Taxi', 'description' => 'Suivre l’activité Taxi, les courses et la flotte.', 'feature_ids' => ['overview', 'trips', 'drivers', 'vehicles']],
                    [
                        'id' => 'transport-gestion',
                        'name' => 'Gestionnaire Taxi',
                        'description' => 'Gérer les courses, les chauffeurs et les véhicules.',
                        'feature_ids' => ['overview', 'trips', 'drivers', 'vehicles'],
                        'feature_permissions' => [
                            'overview' => ['voir'],
                            'trips' => ['voir', 'créer', 'modifier'],
                            'drivers' => ['voir', 'créer', 'modifier'],
                            'vehicles' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'transport-chauffeur',
                        'name' => 'Espace chauffeur Taxi',
                        'description' => 'Permettre au chauffeur de suivre ses courses, son historique et les paramètres opérationnels.',
                        'feature_ids' => ['overview', 'trips', 'historique', 'parametres'],
                        'feature_permissions' => [
                            'overview' => ['voir'],
                            'trips' => ['voir', 'modifier'],
                            'historique' => ['voir'],
                            'parametres' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'transport-employe',
                        'name' => 'Employé Transport',
                        'description' => 'Suivre les courses et l’activité de la flotte sans administrer les chauffeurs.',
                        'feature_ids' => ['overview', 'trips', 'drivers', 'vehicles', 'historique'],
                        'feature_permissions' => [
                            'overview' => ['voir'],
                            'trips' => ['voir', 'modifier'],
                            'drivers' => ['voir'],
                            'vehicles' => ['voir'],
                            'historique' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'transport-manager',
                        'name' => 'Manager Transport',
                        'description' => 'Piloter les courses, les chauffeurs, les véhicules et l’historique Taxi.',
                        'feature_ids' => ['overview', 'trips', 'drivers', 'vehicles', 'historique', 'parametres'],
                        'feature_permissions' => [
                            'overview' => ['voir'],
                            'trips' => ['voir', 'créer', 'modifier'],
                            'drivers' => ['voir', 'créer', 'modifier'],
                            'vehicles' => ['voir', 'créer', 'modifier'],
                            'historique' => ['voir'],
                            'parametres' => ['voir', 'modifier'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'immobilier',
                'name' => 'Immobilier',
                'description' => 'Gérer les biens, les annonces, les prospects et les visites immobilières.',
                'features' => ['Tableau de bord', 'Biens', 'Annonces', 'Prospects', 'Visites', 'Mandats', 'Agents', 'Rapports', 'Paramètres', 'Vitrine publique'],
                'feature_packs' => [
                    ['id' => 'immobilier-consultation', 'name' => 'Consultation immobilière', 'description' => 'Consulter les biens et les annonces publiées.', 'feature_ids' => ['dashboard', 'biens', 'annonces']],
                    [
                        'id' => 'immobilier-agent',
                        'name' => 'Agent immobilier',
                        'description' => 'Gérer les annonces, les prospects et les demandes de visite.',
                        'feature_ids' => ['dashboard', 'biens', 'annonces', 'prospects', 'visites'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'biens' => ['voir', 'créer', 'modifier'],
                            'annonces' => ['voir', 'créer', 'modifier'],
                            'prospects' => ['voir', 'créer', 'modifier'],
                            'visites' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'immobilier-agence',
                        'name' => 'Gestion d’agence',
                        'description' => 'Piloter les annonces, les mandats, les agents, les prospects et la vitrine publique.',
                        'feature_ids' => ['dashboard', 'biens', 'annonces', 'prospects', 'visites', 'mandats', 'agents', 'rapports', 'parametres', 'vitrine-publique'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'biens' => ['voir', 'créer', 'modifier'],
                            'annonces' => ['voir', 'créer', 'modifier'],
                            'prospects' => ['voir', 'créer', 'modifier'],
                            'visites' => ['voir', 'créer', 'modifier'],
                            'mandats' => ['voir', 'créer', 'modifier'],
                            'agents' => ['voir', 'créer', 'modifier'],
                            'rapports' => ['voir'],
                            'parametres' => ['voir', 'modifier'],
                            'vitrine-publique' => ['voir', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'immobilier-manager',
                        'name' => 'Manager immobilier',
                        'description' => 'Superviser l’activité immobilière et les performances de l’équipe.',
                        'feature_ids' => ['dashboard', 'biens', 'annonces', 'prospects', 'visites', 'mandats', 'agents', 'rapports', 'parametres', 'vitrine-publique'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'biens' => ['voir', 'créer', 'modifier'],
                            'annonces' => ['voir', 'créer', 'modifier'],
                            'prospects' => ['voir', 'créer', 'modifier'],
                            'visites' => ['voir', 'créer', 'modifier'],
                            'mandats' => ['voir', 'créer', 'modifier'],
                            'agents' => ['voir', 'modifier'],
                            'rapports' => ['voir'],
                            'parametres' => ['voir', 'modifier'],
                            'vitrine-publique' => ['voir', 'modifier'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'amicales',
                'name' => 'Amicale étudiante',
                'description' => 'Gérer les membres, les cotisations, les dépenses et la vie de l’amicale.',
                'features' => ['Tableau de bord', 'Membres', 'Cotisations', 'Dépenses', 'Activités', 'Annonces', 'Bureau', 'Rapports', 'Mes cotisations'],
                'feature_packs' => [
                    [
                        'id' => 'amicale-consultation',
                        'name' => 'Consultation de l’amicale',
                        'description' => 'Consulter les membres et les informations de la vie étudiante.',
                        'feature_ids' => ['dashboard', 'membres', 'activites', 'annonces'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'membres' => ['voir'],
                            'activites' => ['voir'],
                            'annonces' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'amicale-membres',
                        'name' => 'Gestion des membres',
                        'description' => 'Gérer les adhérents et la composition du bureau.',
                        'feature_ids' => ['dashboard', 'membres', 'bureau'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'membres' => ['voir', 'créer', 'modifier'],
                            'bureau' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'amicale-finances',
                        'name' => 'Trésorerie',
                        'description' => 'Enregistrer les cotisations, les reçus et les dépenses à approuver.',
                        'feature_ids' => ['dashboard', 'membres', 'cotisations', 'depenses', 'rapports'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'membres' => ['voir'],
                            'cotisations' => ['voir', 'créer', 'modifier'],
                            'depenses' => ['voir', 'créer', 'modifier'],
                            'rapports' => ['voir'],
                        ],
                    ],
                    [
                        'id' => 'amicale-activites',
                        'name' => 'Vie étudiante',
                        'description' => 'Organiser les activités et publier les annonces de l’amicale.',
                        'feature_ids' => ['dashboard', 'activites', 'annonces'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'activites' => ['voir', 'créer', 'modifier'],
                            'annonces' => ['voir', 'créer', 'modifier'],
                        ],
                    ],
                    [
                        'id' => 'amicales-employe',
                        'name' => 'Membre de l’amicale',
                        'description' => 'Consulter les activités et les annonces accessibles aux membres.',
                        'feature_ids' => ['dashboard', 'activites', 'annonces', 'mes-cotisations'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'activites' => ['voir'],
                            'annonces' => ['voir'],
                            'mes-cotisations' => ['voir', 'créer'],
                        ],
                    ],
                    [
                        'id' => 'amicales-manager',
                        'name' => 'Responsable d’amicale',
                        'description' => 'Gérer les membres, les finances, les activités et la gouvernance.',
                        'feature_ids' => ['dashboard', 'membres', 'cotisations', 'depenses', 'activites', 'annonces', 'bureau', 'rapports'],
                        'feature_permissions' => [
                            'dashboard' => ['voir'],
                            'membres' => ['voir', 'créer', 'modifier'],
                            'cotisations' => ['voir', 'créer', 'modifier'],
                            'depenses' => ['voir', 'créer', 'modifier'],
                            'activites' => ['voir', 'créer', 'modifier'],
                            'annonces' => ['voir', 'créer', 'modifier'],
                            'bureau' => ['voir', 'créer', 'modifier'],
                            'rapports' => ['voir'],
                        ],
                    ],
                ],
            ],
        ];
    }

    public static function ensureCatalog(): void
    {
        foreach (self::definitionsWithCustom() as $definition) {
            $values = [
                'name' => $definition['name'],
                'description' => $definition['description'],
                'features' => json_encode($definition['features'], JSON_UNESCAPED_UNICODE),
                'feature_dependencies' => json_encode($definition['feature_dependencies'] ?? [], JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ];
            if (DB::table('maximus_modules')->where('id', $definition['id'])->exists()) {
                DB::table('maximus_modules')->where('id', $definition['id'])->update($values);
            } else {
                DB::table('maximus_modules')->insert($values + [
                    'id' => $definition['id'],
                    'status' => 'ACTIF',
                    'created_at' => now(),
                ]);
            }
        }
    }

    public static function ensureCompanyAccess(string $companyId, ?array $moduleIds = null, string $status = 'ACTIF'): void
    {
        self::ensureCatalog();
        $definitions = self::definitionsWithCustom();
        $allowed = $moduleIds ?? array_column($definitions, 'id');
        foreach ($allowed as $moduleId) {
            if (! collect($definitions)->contains('id', $moduleId)) {
                continue;
            }

            if (! DB::table('maximus_company_modules')
                ->where('company_id', $companyId)
                ->where('module_id', $moduleId)
                ->exists()) {
                DB::table('maximus_company_modules')->insert([
                    'id' => 'company-module-'.Str::slug($companyId.'-'.$moduleId),
                    'company_id' => $companyId,
                    'module_id' => $moduleId,
                    'status' => $status,
                    'feature_ids' => json_encode([], JSON_UNESCAPED_UNICODE),
                    // An access row created by the legacy provisioning path
                    // keeps the legacy "whole module" behavior. Modern
                    // registration and explicit edits write featureScope
                    // themselves.
                    'configuration' => json_encode([], JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]);
            }
        }
    }

    public static function isPublishedModule(string $moduleId): bool
    {
        return collect(self::publishedDefinitionsWithCustom())
            ->contains(static fn (array $definition): bool => (string) ($definition['id'] ?? '') === $moduleId);
    }

    /**
     * Return only modules available in the currently published workspace catalog.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function publishedDefinitionsWithCustom(): array
    {
        $definitions = collect(self::definitionsWithCustom());
        $row = DB::table('maximus_app_states')->where('scope', 'workspace')->first();
        $payload = is_string($row?->payload)
            ? json_decode($row->payload, true)
            : ($row?->payload ?? []);
        $state = is_array($payload) ? $payload : [];
        $removedModules = is_array($state['removedModules'] ?? null)
            ? array_map('strval', $state['removedModules'])
            : [];
        $moduleStatuses = is_array($state['moduleStatuses'] ?? null) ? $state['moduleStatuses'] : [];

        return $definitions
            ->filter(static function (array $definition) use ($removedModules, $moduleStatuses): bool {
                $id = (string) ($definition['id'] ?? '');
                if ($id === '' || in_array($id, $removedModules, true)) {
                    return false;
                }

                $status = $moduleStatuses[$id] ?? ($definition['status'] ?? 'ACTIF');
                return in_array($status, ['ACTIF', 'BETA'], true);
            })
            ->values()
            ->all();
    }

    /**
     * Normalize and bound company/module selections to the published catalog.
     *
     * @return array{featureIds: array<int, string>, configuration: array<string, mixed>}
     */
    public static function normalizeSelection(
        string $moduleId,
        array $featureIds = [],
        array $configuration = [],
        bool $ignoreUnknownPermissions = false,
    ): array {
        $definition = collect(self::definitionsWithCustom())->firstWhere('id', $moduleId);
        if (! $definition || ! self::isPublishedModule($moduleId)) {
            throw new \InvalidArgumentException("Le module « {$moduleId} » n’est pas publié.");
        }

        $packs = is_array($definition['feature_packs'] ?? null) ? $definition['feature_packs'] : [];
        $packById = collect($packs)->keyBy('id');
        $packIds = $configuration['packIds'] ?? [];
        if (! is_array($packIds)) {
            throw new \InvalidArgumentException("Les packs du module « {$moduleId} » sont invalides.");
        }
        $packIds = array_values(array_unique(array_map('strval', $packIds)));
        $unknownPacks = array_values(array_diff($packIds, $packById->keys()->all()));
        if ($unknownPacks !== []) {
            throw new \InvalidArgumentException("Le module « {$moduleId} » référence un pack absent.");
        }

        // Packs reference the published feature registry; they must never extend it.
        $aliases = self::featureAliases($definition);
        $canonicalize = static function (mixed $value) use ($aliases, $moduleId): string {
            $value = (string) $value;
            $canonical = $aliases[$value] ?? $aliases[self::featureSlug($value)] ?? $aliases[Str::slug($value)] ?? null;
            if ($canonical === null) {
                throw new \InvalidArgumentException("Le module « {$moduleId} » référence une fonctionnalité absente : {$value}.");
            }
            return $canonical;
        };
        $featureIds = array_values(array_unique(array_map($canonicalize, $featureIds)));

        $packFeatureIds = $packIds === []
            ? []
            : collect($packIds)
                ->flatMap(fn (string $packId): array => $packById->get($packId)['feature_ids'] ?? [])
                ->map($canonicalize)
                ->unique()
                ->values()
                ->all();
        if ($packIds !== [] && array_diff($featureIds, $packFeatureIds) !== []) {
            throw new \InvalidArgumentException('Une fonctionnalité sélectionnée ne appartient pas aux packs choisis.');
        }
        if ($packIds !== [] && $featureIds === [] && ($configuration['featureScope'] ?? null) !== 'explicit') {
            $featureIds = $packFeatureIds;
        }

        $rawPermissions = $configuration['featurePermissions'] ?? [];
        if (! is_array($rawPermissions)) {
            throw new \InvalidArgumentException('Les permissions de fonctionnalités sont invalides.');
        }
        $actions = ['voir', 'créer', 'modifier'];
        $featurePermissions = [];
        foreach ($rawPermissions as $featureId => $permissions) {
            // Approval may encounter permissions for a removed, unselected feature.
            if ($ignoreUnknownPermissions && ! isset($aliases[(string) $featureId]) && ! isset($aliases[self::featureSlug((string) $featureId)]) && ! isset($aliases[Str::slug((string) $featureId)])) {
                continue;
            }
            $featureId = $canonicalize($featureId);
            if (! in_array((string) $featureId, $featureIds, true) || ! is_array($permissions)) {
                if ($ignoreUnknownPermissions) {
                    continue;
                }
                throw new \InvalidArgumentException('Une permission référence une fonctionnalité non sélectionnée.');
            }
            $permissions = array_values(array_unique(array_map('strval', $permissions)));
            if (array_diff($permissions, $actions) !== []) {
                throw new \InvalidArgumentException('Une action de permission est inconnue.');
            }
            $featurePermissions[(string) $featureId] = $permissions;
        }

        return [
            'featureIds' => $featureIds,
            'configuration' => [
                'featureScope' => 'explicit',
                'packIds' => $packIds,
                'featurePermissions' => $featurePermissions,
            ],
        ];
    }

    private static function legacyRequestedModuleStatus(?object $company, string $moduleId): string
    {
        if (($company?->status ?? null) !== 'ACTIF') {
            return 'INACTIF';
        }

        return in_array(
            $moduleId,
            self::decodeArray($company?->requested_modules ?? null),
            true,
        ) ? 'ACTIF' : 'INACTIF';
    }

    private static function decodeArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (! is_string($value)) {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private static function featureSlug(string $value): string
    {
        // Match permission-keys.ts: accents are part of persisted permission IDs.
        return trim(preg_replace('/[^a-z0-9à-ÿ]+/u', '-', mb_strtolower(trim($value))), '-');
    }

    /** Feature identities, independent of editable pack membership. */
    private static function featureAliases(array $definition): array
    {
        // These modules expose fixed operational tabs in getModuleFeatureOptions.
        $fixed = [
            'commerce' => [
                'dashboard' => 'Tableau de bord', 'sales' => 'Ventes & caisse', 'products' => 'Produits & stock',
                'clients' => 'Clients', 'suppliers' => 'Fournisseurs', 'purchases' => 'Achats',
                'expenses' => 'Dépenses', 'cash' => 'Comptes de caisse', 'credit' => 'Crédit clients',
                'invoices' => 'Factures & reçus', 'returns' => 'Retours & avoirs', 'reports' => 'Rapports',
                'activity' => 'Journal d’activité', 'team' => 'Équipe & droits', 'settings' => 'Paramètres',
            ],
            'stocks' => [
                'dashboard' => 'Tableau de bord', 'products' => 'Articles', 'entries' => 'Entrées de stock',
                'exits' => 'Sorties de stock', 'requests' => 'Demandes', 'inventory' => 'Inventaire',
                'reports' => 'Rapports', 'references' => 'Référentiels', 'users' => 'Utilisateurs', 'settings' => 'Paramètres',
            ],
            'ecommerce' => [
                'dashboard' => 'Tableau de bord', 'catalogue' => 'Catalogue', 'vente-physique' => 'Vente de produits physiques',
                'vente-comptoir' => 'Vente comptoir',
                'depenses' => 'Dépenses',
                'investissements' => 'Investissements',
                'rapport-ventes' => 'Rapport des ventes',
                'vente-numerique' => 'Vente de produits numériques', 'categories' => 'Catégories', 'commandes' => 'Commandes',
                'clients' => 'Clients', 'promotions' => 'Promotions', 'location' => 'Location', 'livraisons' => 'Livraisons',
                'finances' => 'Finances & retraits', 'parametres' => 'Paramètres',
            ],
            'transport' => [
                'overview' => 'Vue d’ensemble', 'trips' => 'Courses', 'drivers' => 'Chauffeurs',
                'vehicles' => 'Véhicules', 'historique' => 'Historique', 'parametres' => 'Paramètres',
            ],
            'immobilier' => [
                'dashboard' => 'Tableau de bord', 'biens' => 'Biens', 'annonces' => 'Annonces',
                'prospects' => 'Prospects', 'visites' => 'Visites', 'mandats' => 'Mandats',
                'agents' => 'Agents', 'rapports' => 'Rapports', 'parametres' => 'Paramètres',
                'vitrine-publique' => 'Vitrine publique',
            ],
            'amicales' => [
                'dashboard' => 'Tableau de bord', 'membres' => 'Membres',
                'cotisations' => 'Cotisations', 'depenses' => 'Dépenses',
                'activites' => 'Activités', 'annonces' => 'Annonces',
                'bureau' => 'Bureau', 'rapports' => 'Rapports',
            ],
        ];
        $options = $fixed[$definition['id']] ?? collect($definition['features'] ?? [])
            ->mapWithKeys(fn ($label): array => [self::featureSlug((string) $label) => (string) $label])->all();
        $aliases = [];
        foreach ($options as $id => $label) {
            foreach ([$id, self::featureSlug($label), Str::slug($label), Str::slug($id)] as $alias) {
                // An ambiguous transliteration must not point at another identity.
                if (isset($aliases[$alias]) && $aliases[$alias] !== $id) {
                    continue;
                }
                $aliases[$alias] = $id;
            }
        }
        $legacy = match ($definition['id']) {
            'commerce' => ['devis-et-commandes' => 'sales', 'chiffre-d-affaires' => 'dashboard'],
            'paie' => ['dashboard' => 'tableau-de-bord', 'preparation' => 'préparer-une-paie', 'solde-paie' => 'solde-de-paie'],
            default => [],
        };
        foreach ($legacy as $alias => $id) {
            if (isset($options[$id])) {
                $aliases[$alias] = $id;
            }
        }
        return $aliases;
    }

    public static function isEnabled(string $companyId, string $moduleId): bool
    {
        return in_array(self::statusFor($companyId, $moduleId), ['ACTIF', 'BETA'], true);
    }

    public static function allowsFeature(string $companyId, string $moduleId, string $featureId): bool
    {
        if (! self::isEnabled($companyId, $moduleId)) {
            return false;
        }

        $row = DB::table('maximus_company_modules')
            ->where('company_id', $companyId)
            ->where('module_id', $moduleId)
            ->first(['feature_ids', 'configuration']);
        if (! $row) {
            $company = DB::table('companies')
                ->where('id', $companyId)
                ->first(['requested_module_features', 'requested_module_pack_ids']);
            $requestedFeatures = self::decodeArray($company?->requested_module_features ?? null);
            $requestedPacks = self::decodeArray($company?->requested_module_pack_ids ?? null);
            $featureIds = self::decodeArray($requestedFeatures[$moduleId] ?? null);
            $packIds = self::decodeArray($requestedPacks[$moduleId] ?? null);

            // Legacy company access has no explicit feature scope when neither
            // a feature selection nor a pack was stored in the signup request.
            if ($featureIds === [] && $packIds === []) {
                return $moduleId !== 'ecommerce'
                    || ! in_array($featureId, ['vente-numerique', 'vente-comptoir', 'rapport-ventes', 'depenses', 'investissements'], true);
            }

            try {
                $selection = self::normalizeSelection($moduleId, $featureIds, [
                    ...($featureIds !== [] ? ['featureScope' => 'explicit'] : []),
                    'packIds' => $packIds,
                ]);
            } catch (\InvalidArgumentException) {
                return false;
            }

            return in_array($featureId, $selection['featureIds'], true);
        }

        $featureIds = json_decode($row->feature_ids ?? '[]', true);
        $configuration = json_decode($row->configuration ?? '{}', true);
        if (! is_array($featureIds)) {
            $featureIds = [];
        }
        if (! is_array($configuration)) {
            $configuration = [];
        }

        // Legacy rows with no explicit scope preserve physical sales for existing
        // catalogues, but digital sales, POS, and the sales report require explicit grants.
        // New writes set featureScope=explicit, including an intentionally empty list.
        if (($configuration['featureScope'] ?? null) === 'explicit') {
            return in_array($featureId, $featureIds, true);
        }
        if (in_array($featureId, ['vente-numerique', 'vente-comptoir', 'rapport-ventes', 'depenses', 'investissements'], true)) {
            return false;
        }
        if ($featureId === 'vente-physique') {
            return $featureIds === [] || in_array('catalogue', $featureIds, true);
        }
        if ($featureIds !== []) {
            return in_array($featureId, $featureIds, true);
        }

        return true;
    }

    public static function statusFor(string $companyId, string $moduleId): string
    {
        $access = DB::table('maximus_company_modules')
            ->where('company_id', $companyId)
            ->where('module_id', $moduleId)
            ->first(['status']);

        if ($access) {
            return (string) $access->status;
        }

        $company = DB::table('companies')
            ->where('id', $companyId)
            ->first(['status', 'requested_modules']);

        return self::legacyRequestedModuleStatus($company, $moduleId);
    }

    public static function bootstrap(string $companyId): array
    {
        $access = DB::table('maximus_company_modules')
            ->where('company_id', $companyId)
            ->get()
            ->keyBy('module_id');
        $company = DB::table('companies')
            ->where('id', $companyId)
            ->first([
                'status',
                'requested_modules',
                'requested_module_features',
                'requested_module_pack_ids',
                'requested_module_permissions',
            ]);
        $requestedFeatures = self::decodeArray($company?->requested_module_features ?? null);
        $requestedPacks = self::decodeArray($company?->requested_module_pack_ids ?? null);
        $requestedPermissions = self::decodeArray($company?->requested_module_permissions ?? null);

        return collect(self::definitionsWithCustom())->map(function (array $definition) use (
            $access,
            $company,
            $requestedFeatures,
            $requestedPacks,
            $requestedPermissions,
        ): array {
            $row = $access->get($definition['id']);
            if ($row) {
                $status = (string) $row->status;
                $featureIds = self::decodeArray($row->feature_ids ?? null);
                $configuration = self::decodeArray($row->configuration ?? null);
            } else {
                $moduleId = $definition['id'];
                $requestedFeatureIds = self::decodeArray($requestedFeatures[$moduleId] ?? null);
                $packIds = self::decodeArray($requestedPacks[$moduleId] ?? null);
                $featurePermissions = self::decodeArray($requestedPermissions[$moduleId] ?? null);
                $configuration = [];
                if ($requestedFeatureIds !== []) {
                    $configuration['featureScope'] = 'explicit';
                }
                if ($packIds !== []) {
                    $configuration['packIds'] = $packIds;
                }
                if ($featurePermissions !== []) {
                    $configuration['featurePermissions'] = $featurePermissions;
                }
                $featureIds = [];
                if ($requestedFeatureIds !== [] || $packIds !== []) {
                    try {
                        $selection = self::normalizeSelection($moduleId, $requestedFeatureIds, $configuration);
                        $featureIds = $selection['featureIds'];
                        $configuration = $selection['configuration'];
                    } catch (\InvalidArgumentException) {
                        // A stale signup selection must not expand access.
                        $configuration = ['featureScope' => 'explicit'];
                    }
                }
                $status = self::legacyRequestedModuleStatus($company, $moduleId);
            }

            return [
                ...$definition,
                'status' => $status,
                'featureIds' => $featureIds,
                'configuration' => $configuration,
                'featurePacks' => collect($definition['feature_packs'] ?? [])
                    ->map(fn (array $pack): array => [
                        'id' => $pack['id'],
                        'name' => $pack['name'],
                        'description' => $pack['description'],
                        'featureIds' => $pack['feature_ids'],
                        'featurePermissions' => $pack['feature_permissions'] ?? [],
                    ])
                    ->values()
                    ->all(),
                'featureDependencies' => $definition['feature_dependencies'] ?? [],
            ];
        })->all();
    }

    /**
     * Export the published definitions needed by an isolated installation.
     *
     * Company access and catalog definitions are separate concerns. A
     * dedicated installation must receive both because a published custom pack
     * may not exist in its built-in catalog.
     *
     * @param array<int, string> $moduleIds
     * @return array<int, array<string, mixed>>
     */
    public static function publishedCatalog(array $moduleIds): array
    {
        $wanted = array_fill_keys(array_values(array_unique(array_map('strval', $moduleIds))), true);

        return collect(self::definitionsWithCustom())
            ->filter(static fn (array $definition): bool => isset($wanted[(string) ($definition['id'] ?? '')]))
            ->map(fn (array $definition): array => self::publishedDefinitionPayload($definition))
            ->values()
            ->all();
    }

    /**
     * Import published definitions into the local workspace catalog.
     *
     * This is used only during installation/provisioning, not during a normal
     * authenticated app bootstrap.
     *
     * @param array<int, mixed> $catalog
     */
    public static function importPublishedCatalog(array $catalog): void
    {
        $incoming = collect($catalog)
            ->filter(static fn (mixed $module): bool => is_array($module))
            ->map(fn (array $module): ?array => self::normalizePublishedDefinition($module))
            ->filter(static fn (?array $module): bool => is_array($module))
            ->keyBy('id');

        if ($incoming->isEmpty()) {
            return;
        }

        $row = DB::table('maximus_app_states')->where('scope', 'workspace')->first();
        $payload = is_string($row?->payload)
            ? json_decode($row->payload, true)
            : ($row?->payload ?? []);
        $state = is_array($payload) ? $payload : [];
        $moduleOverrides = is_array($state['moduleOverrides'] ?? null) ? $state['moduleOverrides'] : [];
        $customModules = collect(is_array($state['customModules'] ?? null) ? $state['customModules'] : [])
            ->filter(static fn (mixed $module): bool => is_array($module) && is_string($module['id'] ?? null))
            ->keyBy('id');
        $moduleStatuses = is_array($state['moduleStatuses'] ?? null) ? $state['moduleStatuses'] : [];
        $builtInIds = array_fill_keys(array_map('strval', array_column(self::definitions(), 'id')), true);

        foreach ($incoming as $moduleId => $module) {
            if (isset($builtInIds[$moduleId])) {
                $moduleOverrides[$moduleId] = [
                    'name' => $module['name'],
                    'description' => $module['description'],
                    'features' => $module['features'],
                    'featurePacks' => $module['featurePacks'],
                    'featureDependencies' => $module['featureDependencies'],
                ];
            } else {
                $customModules->put($moduleId, $module);
            }
            $moduleStatuses[$moduleId] = $module['status'];
        }

        $incomingIds = $incoming->keys()->map('strval')->all();
        $state['moduleOverrides'] = $moduleOverrides;
        $state['customModules'] = $customModules->values()->all();
        $state['moduleStatuses'] = $moduleStatuses;
        $state['removedModules'] = array_values(array_diff(
            is_array($state['removedModules'] ?? null) ? array_map('strval', $state['removedModules']) : [],
            $incomingIds,
        ));

        DB::table('maximus_app_states')->updateOrInsert(
            ['scope' => 'workspace'],
            [
                'company_id' => null,
                'payload' => json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'version' => ((int) ($row?->version ?? 0)) + 1,
                'updated_at' => now(),
                'created_at' => $row?->created_at ?? now(),
            ],
        );
    }

    /**
     * Convert the frontend catalog shape into the internal catalog shape used
     * by server-side selection validation.
     *
     * Published overrides are intentionally stored in camelCase because they
     * are shared with the React workspace state. Registration must validate
     * against those same published packs, not only against built-in defaults.
     *
     * @param mixed $packs
     * @param array<int, array<string, mixed>> $fallback
     * @return array<int, array<string, mixed>>
     */
    private static function normalizeFeaturePacks(mixed $packs, array $fallback = []): array
    {
        $source = is_array($packs) ? $packs : $fallback;

        return collect($source)
            ->map(static function (mixed $pack): ?array {
                if (! is_array($pack)) {
                    return null;
                }

                $featureIds = $pack['feature_ids'] ?? $pack['featureIds'] ?? [];
                $permissions = $pack['feature_permissions'] ?? $pack['featurePermissions'] ?? [];

                return [
                    'id' => (string) ($pack['id'] ?? ''),
                    'name' => (string) ($pack['name'] ?? ''),
                    'description' => (string) ($pack['description'] ?? ''),
                    'feature_ids' => is_array($featureIds) ? array_values(array_map('strval', $featureIds)) : [],
                    'feature_permissions' => is_array($permissions) ? $permissions : [],
                ];
            })
            ->filter(static fn (?array $pack): bool => is_array($pack) && $pack['id'] !== '')
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    private static function publishedDefinitionPayload(array $definition): array
    {
        return [
            'id' => (string) $definition['id'],
            'name' => (string) ($definition['name'] ?? $definition['id']),
            'description' => (string) ($definition['description'] ?? ''),
            'features' => is_array($definition['features'] ?? null)
                ? array_values(array_map('strval', $definition['features']))
                : [],
            'featurePacks' => collect(is_array($definition['feature_packs'] ?? null) ? $definition['feature_packs'] : [])
                ->map(static fn (array $pack): array => [
                    'id' => (string) ($pack['id'] ?? ''),
                    'name' => (string) ($pack['name'] ?? ''),
                    'description' => (string) ($pack['description'] ?? ''),
                    'featureIds' => is_array($pack['feature_ids'] ?? null)
                        ? array_values(array_map('strval', $pack['feature_ids']))
                        : [],
                    'featurePermissions' => is_array($pack['feature_permissions'] ?? null)
                        ? $pack['feature_permissions']
                        : [],
                ])
                ->filter(static fn (array $pack): bool => $pack['id'] !== '')
                ->values()
                ->all(),
            'featureDependencies' => is_array($definition['feature_dependencies'] ?? null)
                ? $definition['feature_dependencies']
                : [],
            'status' => in_array(($definition['status'] ?? 'ACTIF'), ['ACTIF', 'BETA'], true)
                ? ($definition['status'] ?? 'ACTIF')
                : 'ACTIF',
        ];
    }

    /** @return array<string, mixed>|null */
    private static function normalizePublishedDefinition(array $module): ?array
    {
        $id = trim((string) ($module['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $featurePacks = self::normalizeFeaturePacks(
            $module['featurePacks'] ?? $module['feature_packs'] ?? [],
        );

        return [
            'id' => $id,
            'name' => trim((string) ($module['name'] ?? $id)),
            'description' => trim((string) ($module['description'] ?? '')),
            'features' => is_array($module['features'] ?? null)
                ? array_values(array_map('strval', $module['features']))
                : [],
            'featurePacks' => array_map(
                static fn (array $pack): array => [
                    'id' => $pack['id'],
                    'name' => $pack['name'],
                    'description' => $pack['description'],
                    'featureIds' => $pack['feature_ids'],
                    'featurePermissions' => $pack['feature_permissions'],
                ],
                $featurePacks,
            ),
            'featureDependencies' => is_array($module['featureDependencies'] ?? null)
                ? $module['featureDependencies']
                : (is_array($module['feature_dependencies'] ?? null) ? $module['feature_dependencies'] : []),
            'status' => in_array(($module['status'] ?? 'ACTIF'), ['ACTIF', 'BETA'], true)
                ? ($module['status'] ?? 'ACTIF')
                : 'ACTIF',
        ];
    }

    /**
     * Apply a published frontend module override to a server definition.
     *
     * @param mixed $rawOverride
     * @return array<string, mixed>
     */
    private static function applyPublishedOverride(array $definition, mixed $rawOverride): array
    {
        if (! is_array($rawOverride)) {
            return $definition;
        }

        if (is_string($rawOverride['name'] ?? null)) {
            $definition['name'] = $rawOverride['name'];
        }
        if (is_string($rawOverride['description'] ?? null)) {
            $definition['description'] = $rawOverride['description'];
        }
        if (is_array($rawOverride['features'] ?? null)) {
            $definition['features'] = array_values(array_map('strval', $rawOverride['features']));
        }
        if (is_array($rawOverride['featurePacks'] ?? null) || is_array($rawOverride['feature_packs'] ?? null)) {
            $definition['feature_packs'] = self::normalizeFeaturePacks(
                $rawOverride['featurePacks'] ?? $rawOverride['feature_packs'],
            );
        }
        if (is_array($rawOverride['featureDependencies'] ?? null)) {
            $definition['feature_dependencies'] = $rawOverride['featureDependencies'];
        } elseif (is_array($rawOverride['feature_dependencies'] ?? null)) {
            $definition['feature_dependencies'] = $rawOverride['feature_dependencies'];
        }

        return $definition;
    }

    /**
     * Published custom modules live in the workspace catalog because they are
     * created through the MAXI draft workflow. Built-in definitions remain the
     * source of truth for the standard modules.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function definitionsWithCustom(): array
    {
        $row = DB::table('maximus_app_states')->where('scope', 'workspace')->first();
        $payload = is_string($row?->payload)
            ? json_decode($row->payload, true)
            : ($row?->payload ?? []);
        $state = is_array($payload) ? $payload : [];
        $custom = is_array($state['customModules'] ?? null) ? $state['customModules'] : [];
        $overrides = is_array($state['moduleOverrides'] ?? null) ? $state['moduleOverrides'] : [];

        $normalizedDefinitions = collect(self::definitions())
            ->map(fn (array $definition): array => self::applyPublishedOverride(
                $definition,
                $overrides[$definition['id']] ?? null,
            ))
            ->values()
            ->all();

        $normalizedCustom = collect($custom)
            ->filter(static fn (mixed $module): bool => is_array($module) && is_string($module['id'] ?? null))
            ->map(static fn (array $module): array => [
                'id' => (string) $module['id'],
                'name' => (string) ($module['name'] ?? $module['id']),
                'description' => (string) ($module['description'] ?? ''),
                'features' => is_array($module['features'] ?? null) ? $module['features'] : [],
                'feature_packs' => self::normalizeFeaturePacks($module['featurePacks'] ?? $module['feature_packs'] ?? []),
                'feature_dependencies' => is_array($module['featureDependencies'] ?? null) ? $module['featureDependencies'] : [],
                'status' => in_array(($module['status'] ?? 'ACTIF'), ['ACTIF', 'BETA'], true)
                    ? ($module['status'] ?? 'ACTIF')
                    : 'ACTIF',
            ])
            ->map(fn (array $definition): array => self::applyPublishedOverride(
                $definition,
                $overrides[$definition['id']] ?? null,
            ))
            ->values()
            ->all();

        return [
            ...$normalizedDefinitions,
            ...$normalizedCustom,
        ];
    }
}
