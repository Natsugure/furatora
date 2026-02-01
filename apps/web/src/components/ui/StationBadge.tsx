type Props = {
  code: string | null;
  color: string | null;
};

export function StationBadge({ code, color }: Props) {
  const borderColor = color || '#888888';

  if (!code) {
    return (
      <div
        className="w-12 h-12 rounded-full border-4 flex items-center justify-center bg-white text-gray-400 text-xs flex-shrink-0"
        style={{ borderColor }}
      >
        -
      </div>
    );
  }

  // Parse station code (e.g., "M08" -> { prefix: "M", number: "08" })
  const match = code.match(/^([A-Z]+)(\d+)$/);

  return (
    <div
      className="w-12 h-12 rounded-full border-4 flex flex-col items-center justify-center bg-white font-bold flex-shrink-0"
      style={{ borderColor }}
    >
      {match ? (
        <>
          <span className="text-xs leading-none" style={{ color: borderColor }}>
            {match[1]}
          </span>
          <span className="text-sm leading-none">{match[2]}</span>
        </>
      ) : (
        <span className="text-xs">{code}</span>
      )}
    </div>
  );
}
