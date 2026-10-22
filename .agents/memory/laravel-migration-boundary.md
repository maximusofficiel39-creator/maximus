---
name: Migration Laravel progressive
description: Contraintes durables pour faire coexister Laravel et Express pendant la migration MAXIMUS.
---

Laravel doit rester parallèle et réversible tant que la parité avec Express n’est pas démontrée. Les migrations MAXIMUS peuvent être exécutées dans un environnement de développement isolé ; elles ne doivent pas recréer les tables déjà présentes ni déclencher le remplacement du workflow API actif.

**Why:** PostgreSQL reste la source de vérité de MAXIMUS et les comptes existants utilisent le format scrypt d’Express. Une bascule prématurée risquerait de casser les connexions ou les données.

**How to apply:** Tester les contrats Laravel sur SQLite local ou une base PostgreSQL de développement, comparer les réponses à Express, puis seulement planifier un changement de workflow et une migration de production.

Avant d’exécuter `php artisan migrate`, inspecter toutes les migrations en attente : Laravel applique l’ensemble du lot, pas uniquement les nouvelles migrations de la fonctionnalité courante.

**Why:** Le workflow local peut être relié à une base partagée contenant des retards de schéma provenant d’autres modules ; les appliquer sans inspection élargit le changement au-delà de la demande.

**How to apply:** Lancer `migrate:status`, examiner chaque migration en attente et confirmer la cible de base. Pour ne tester qu’une migration, utiliser une base de test isolée ou un test `RefreshDatabase`.

Ne pas déduire que la base du workflow actif suit les migrations de la suite de tests : `RefreshDatabase` valide le schéma de test, pas celui du service en cours. Éviter qu’un nouveau code dépende d’une colonne absente tant que la cible n’a pas été confirmée.

**Why:** Un test Laravel peut passer alors que la base PostgreSQL du workflow est restée en retard, et l’API échoue seulement à la première requête réelle.

**How to apply:** Vérifier le statut et la cible de la base avant toute migration; si d’autres migrations sont en attente, ne pas lancer le lot complet pour débloquer une seule fonctionnalité.

Les catalogues de modules front et Laravel doivent partager un contrat testé, notamment pour les fonctionnalités et leurs dépendances.

**Why:** Une migration parallèle peut rester techniquement verte tout en exposant deux offres différentes à l’utilisateur si chaque runtime conserve sa propre définition.

**How to apply:** Toute évolution d’un module doit mettre à jour les deux représentations ou introduire une source de vérité partagée, puis ajouter un test de parité de catalogue avant la bascule.