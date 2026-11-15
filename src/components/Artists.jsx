import { Play } from './Icons';

export default function Artists({ items, onPick, loading }) {
  if (loading) return (
    <div className="artists">
      {Array.from({ length: 8 }, (_, i) => (
        <div className="artist" key={i}><div className="skel artist-img" /><div className="skel skel-line" /></div>
      ))}
    </div>
  );
  return (
    <div className="artists">
      {items.map(a => (
        <button className="artist" key={a.id} onClick={() => onPick(a)} title={`Écouter ${a.name}`}>
          <div className="artist-img">
            <img src={a.imgUrl} alt="" loading="lazy" />
            <span className="artist-play"><Play size={22} /></span>
          </div>
          <span className="artist-name">{a.name}</span>
        </button>
      ))}
    </div>
  );
}
