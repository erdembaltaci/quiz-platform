// src/components/Leaderboard.js
const Leaderboard = ({ players }) => (
  <div className="leaderboard">
    {players.map((player, index) => (
      <div key={player.id} className="player-row">
        <span>{index + 1}. {player.name}</span>
        <span>{player.score} puan</span>
      </div>
    ))}
  </div>
);
export default Leaderboard;
