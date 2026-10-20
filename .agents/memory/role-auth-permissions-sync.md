---
name: Synchronisation rôles et comptes
description: Les permissions d’un rôle MAXIMUS doivent être recopiées dans le compte authentifié de chaque employé affecté.
---

Les droits affichés dans l’espace entreprise et les droits appliqués par les API ne partagent pas automatiquement la même persistance : le rôle métier est dans l’état MAXIMUS, tandis que l’autorisation serveur de connexion est dans le compte employé. Toute modification d’un rôle doit donc synchroniser les comptes affectés avant de confirmer la modification locale.

**Why:** Un compte de production peut conserver uniquement `voir` alors que l’interface d’un rôle affiche `créer` et `modifier`, ce qui rend les boutons visibles mais provoque un `403` sur l’API.

**How to apply:** Lorsqu’un rôle existant est enregistré, reprovisionner chaque compte employé affecté avec ses secteurs, son type de compte et les permissions normalisées du rôle. Ne jamais retirer le contrôle serveur pour masquer cette divergence.

Pour réparer un rôle prérempli encore lié à un pack, recalculer ses droits depuis le pack sélectionné, les limites de l’entreprise et le périmètre de l’unité, sans élargir les permissions précédentes. Mettre à jour les comptes actifs concernés avant d’enregistrer le rôle réparé; si un compte échoue, ne pas confirmer la réparation.

**Why:** Un rôle métier corrigé ne révoque pas automatiquement les permissions déjà copiées dans les comptes authentifiés; une réparation locale seule peut laisser des droits incohérents.

**How to apply:** Réparer uniquement les packs toujours sélectionnés, tester le chemin d’affectation avec un compte actif et couvrir le cas d’échec de provisionnement. Garder les contrôles d’entreprise et d’unité stricts plutôt que de rendre sélectionnable un rôle incompatible.

Les réparations automatiques de rôles préremplis à l’ouverture d’Organisation & accès sont réservées à MAXIMUS et aux administrateurs d’entreprise. Les managers et employés ne déclenchent pas cette écriture de réparation en arrière-plan; leurs mutations explicites restent bornées par leurs autorisations serveur.

**Why:** Un compte manager qui lançait une réparation automatique pouvait provoquer un refus 403 de l’API et des notifications répétées à l’ouverture de la liste des employés.

**How to apply:** Garder la réparation automatique pour les administrateurs, avec synchronisation serveur des comptes affectés avant sauvegarde. Ne jamais la lancer depuis une session manager ou employé; ne pas élargir leurs permissions pour contourner le refus.