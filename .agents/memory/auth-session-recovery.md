---
name: Reprise des sessions après déploiement
description: Comportement sûr des sessions navigateur quand l’API redémarre ou répond temporairement en erreur.
---

Ne pas effacer l’indice de session du navigateur sur une erreur réseau lors du bootstrap d’authentification. Seule une réponse explicite indiquant l’absence d’utilisateur permet de nettoyer cet état. Les sessions actives doivent renouveler leur expiration glissante via heartbeat pour tous les rôles, tout en conservant leur durée d’inactivité prévue.

**Why:** Un redéploiement peut interrompre brièvement l’API sans invalider la session stockée en base; effacer l’état client transforme une interruption transitoire en déconnexion visible.

**How to apply:** L’API et la base doivent rester stables entre déploiements. Garder `APP_KEY` et la base persistantes; ne jamais régénérer la clé au démarrage. Ne jamais convertir un échec réseau de `/auth/session` en logout.
