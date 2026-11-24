# Budget — Next.js + Prisma + SQLite

Application unique : plus de backend Symfony. L'API est dans `app/api/**`
(route handlers Next.js), la logique métier dans `lib/server/**`, et les
données dans une base SQLite gérée par Prisma.

## Démarrage

```bash
npm install                # génère aussi le client Prisma
npm run db:push            # crée prisma/dev.db à partir de prisma/schema.prisma
npm run db:seed            # (optionnel) données de démonstration
npm run dev
```

## Reprendre les données de l'ancienne base MySQL

```bash
MYSQL_URL="mysql://user:motdepasse@127.0.0.1:3306/nom_base" npm run db:import-mysql
```

À lancer sur une base SQLite vide (après `db:push`). Les identifiants sont conservés.

## Notes

- Les montants sont stockés en centimes (entiers) ; l'API les expose en chaînes « 12.50 ».
- Après une modification de `prisma/schema.prisma` : `npm run db:push`.
- `npm run db:studio` ouvre une interface pour consulter la base.

## Lien avec Factum (factures)

Page **Configuration > Factum** : on indique seulement l'identifiant de Factum dans Triviae.
Ensuite, dans la vue d'un mois du budget, le bouton **Ajouter facture de Factum** liste les factures de Factum
(plage : janvier de l'an dernier à décembre de l'année affichée) ; on coche celles à ajouter et on choisit le compte et la catégorie.
Chaque facture devient une ligne de budget du mois affiché (prévu = réalisé = montant de la facture). Une facture déjà ajoutée est signalée.

- Factum fournit `GET /api/budget?from=YYYY-MM-DD&to=YYYY-MM-DD` -> `{ "invoices": [{ id, company, amount, date, reference?, path? }] }` (800 jours max).
- Rien n'est copié automatiquement ; les montants sont relus dans Factum au moment de l'ajout.
- « Délier » ne supprime aucune ligne : celles déjà ajoutées restent.
- La page « Liens » de Triviae lit `GET /api/liens` : le budget y déclare Factum (direction « in ») dès qu'il est lié.
- Si le port de Triviae est inhabituel, définir `HUB_URL`.
- Après mise à jour : `npm install` puis `npm run db:push` (table `factum_connection`, colonne `factumInvoiceId`).
