import FactumLinkPanel from "@/components/Factum/FactumLinkPanel";

export default function FactumPage() {
  return (
    <>
      <h1 className="h3 mb-2">
        <i className="bi bi-receipt me-2 text-primary"></i>Factum
      </h1>
      <p className="text-muted">
        Une fois Factum lié, le bouton « Ajouter facture de Factum » de la vue d'un mois du budget permet de choisir
        les factures à ajouter (une ligne de dépense par facture). Les factures se modifient dans Factum.
      </p>
      <FactumLinkPanel />
    </>
  );
}
