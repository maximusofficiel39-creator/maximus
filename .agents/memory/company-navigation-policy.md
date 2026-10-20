---
name: Choix de navigation et verrouillage des autorisations
description: Qui choisit la navigation par entreprise et comment prévenir les modifications accidentelles des autorisations MAXIMUS.
---

Chaque entreprise peut utiliser deux modes exclusifs : fonctionnalités dans le menu principal (défaut), ou noms des modules dans le menu et fonctionnalités du module courant horizontalement en haut de page. Conserver les mêmes permissions dans les deux modes.

MAXIMUS choisit le mode et décide séparément si les administrateurs de l’entreprise peuvent le changer. Sans cette autorisation, le contrôle est masqué côté entreprise et la modification est interdite côté serveur. Les employés et managers de secteur ne choisissent pas ce réglage. Retirer l’autorisation conserve le mode déjà enregistré.

**Why:** L’utilisateur a choisi « Les deux » pour les propriétaires du réglage, puis précisé : « Mais l’entreprise doit avoir une autorisation de MAXIMUS pour voir le bouton ».

**How to apply:** Maintenir le menu par défaut pour les entreprises existantes. Ne pas confondre l’autorisation de personnaliser la navigation avec les droits d’accès aux modules. Les métadonnées partagées ou un ancien navigateur ne doivent pas pouvoir accorder ce droit.

Les contrôles d’autorisation MAXIMUS sont verrouillés par défaut, avec déverrouillage explicite et confirmation avant enregistrement, puis retour au verrou après réussite. Ce verrou prévient les erreurs de manipulation ; il ne remplace pas les autorisations serveur.

**Why:** L’utilisateur demande « un verrou de sécurité pour éviter de cocher ou décocher par erreur ».

**How to apply:** Protéger aussi les actions de masse, les clics sur les libellés et le clavier. Annuler une confirmation ne modifie aucune autorisation. Un échec ne doit pas être annoncé comme un enregistrement réussi.

Dans l’administration MAXIMUS, verrouiller chaque zone de réglages sensibles séparément; ne pas mettre un verrou global qui bloque les réglages indépendants de la page.

**Why:** L’utilisateur a signalé qu’un verrou unique rend les réglages difficiles et a demandé qu’il soit placé à côté des réglages concernés.

**How to apply:** Créer un gate distinct pour chaque groupe cohérent (site public, connexion, navigation, visibilité, notifications, paiement, modules) et confirmer les changements avant leur enregistrement.

Pour une installation dédiée, une synchronisation ordinaire ne doit pas écraser un mode choisi localement. Une nouvelle directive centrale peut réappliquer le mode, même si MAXIMUS sélectionne la même valeur qu’avant.

**Why:** La personnalisation serait perdue silencieusement si chaque synchronisation répétait l’ancien choix central.

**How to apply:** Distinguer la répétition d’un instantané de configuration et une nouvelle décision de navigation ; ignorer les directives de navigation plus anciennes.