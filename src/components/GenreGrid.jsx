export default function GenreGrid({ genres, active, onSelect }) {
  return (
    <div className="genres">
      {genres.map(g => (
        <button key={g.id} className={`genre${g.id === active ? ' active' : ''}`}
          style={{ '--c': g.color }} onClick={() => onSelect(g)}>
          {g.name}
        </button>
      ))}
    </div>
  );
}
