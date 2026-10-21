---
name: Dépenses e-commerce autonomes
description: Règles de navigation et d’autorisation pour le suivi des dépenses e-commerce.
---

Les dépenses e-commerce doivent être une fonctionnalité de premier niveau dans le menu, distincte de Vente comptoir. Leur consultation et leur création ont des droits propres ; un accès Vente comptoir existant ne doit pas accorder Dépenses automatiquement. Le chiffre d’affaires brut reste présenté séparément et le solde net est calculé comme un indicateur distinct.

**Why:** l’utilisateur a précisé que « la dépense est une fonctionnalité » et ne doit pas rester dans Vente comptoir.

**How to apply:** conserver l’identité canonique `depenses` dans le catalogue, les packs, la navigation et les contrôles serveur ; exiger un choix explicite pour les entreprises et rôles existants.
