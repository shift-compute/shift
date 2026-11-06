export default function NightNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">That night id is not valid</h1>
      <p className="max-w-2xl text-haze">A night id is the UTC date, written YYYYMMDD, or the unix time of a manual run.</p>
      <p>
        <a href="/">Back to Shift</a>
      </p>
    </div>
  );
}
