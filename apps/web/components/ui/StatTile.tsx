export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <p className="stat-tile-value">{value}</p>
      <p className="stat-tile-label">{label}</p>
    </div>
  );
}
