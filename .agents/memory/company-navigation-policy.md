---
name: Choix de navigation et verrouillage des autorisations
description: Qui choisit la navigation par entreprise et comment prévenir les modifications accidentelles des autorisations MAXIMUS.
---

Chaque entreprise peut utiliser deux modes exclusifs : fonctionnalités dans le menu principal (défaut), ou noms des modules dans le menu et fonctionnalités du module courant horizontalement en haut de page. Conserver les mêmes permissions dans les deux modes.

MAXIMUS choisit le mode et décide séparément si les administrateurs de l’entreprise peuvent le changer. Sans cette autorisation, le contrôle est masqué côté entreprise et la modification est interdite côté serveur. Les employés et managers de secteur ne choisissent pas ce réglage. Retirer l’autorisation conserve le mode déjà enregistré.

**Why:** L’utilisateur a choisi « Les deux » pour les propriétaires du réglage, puis précisé : « Mais l’entreprise doit avoir une autorisation de MAXIMUS pour voir le bouton ».

**How to apply:** Maintenir le menu par défaut pour les entreprises existantes. Ne pas confondre l’autorisation de personnaliser la navigation avec les droits d’accès aux modules. Les métadonnées partagées ou un ancien navigateur ne doivent pas pouvoir accorder ce droit.

Les réglages d’entreprise ne doivent pas imposer de verrouillage manuel, d’étape « Déverrouiller » ou de confirmation avant chaque enregistrement. Garder les permissions réelles et leur validation côté serveur.

**Why:** Le 20 octobre 2026, l’utilisateur a demandé de supprimer le système de verrouillage des réglages d’entreprise car il était trop gênant.

**How to apply:** Les contrôles restent directement modifiables par les acteurs autorisés. Conserver uniquement les confirmations spécifiques aux opérations destructives, comme retirer un domaine.

Pour une installation dédiée, une synchronisation ordinaire ne doit pas écraser un mode choisi localement. Une nouvelle directive centrale peut réappliquer le mode, même si MAXIMUS sélectionne la même valeur qu’avant.

**Why:** La personnalisation serait perdue silencieusement si chaque synchronisation répétait l’ancien choix central.

**How to apply:** Distinguer la répétition d’un instantané de configuration et une nouvelle décision de navigation ; ignorer les directives de navigation plus anciennes.