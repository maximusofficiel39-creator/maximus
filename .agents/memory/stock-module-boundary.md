---
name: Périmètre du module Stock
description: Règle métier du module Stock concernant les articles, les ventes et les catégories.
---

Le module Stock sert à gérer des articles conservés et leurs quantités. Il ne gère ni la vente des articles, ni leurs prix d’achat ou de vente. Les catégories sont créées par chaque entreprise et restent séparées entre entreprises.

**Why:** L’utilisateur a précisé que le stock concerne uniquement des produits stockés, sans activité de vente, et que les catégories doivent être propres à chaque entreprise.

**How to apply:** Garder les entrées, sorties, transferts, inventaires et seuils de stock. Ne pas réintroduire de prix ni de parcours commerciaux dans les fiches, tableaux ou rapports. Conserver la portée d’entreprise côté serveur pour les catégories.
