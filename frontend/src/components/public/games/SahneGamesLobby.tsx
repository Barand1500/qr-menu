import { useState } from "react";
import { ArrowUpRight, Gamepad2 } from "lucide-react";
import { type MenuGameId } from "@/lib/menuGames";
import { gameCatalogEntry } from "@/lib/menuGamesUi";
import SahneActivityArt from "../sahne/SahneActivityArt";
import "./games-lobby.css";

export default function SahneGamesLobby({
  games,
  lang,
  onPlay,
}: {
  games: MenuGameId[];
  lang: string;
  onPlay: (id: MenuGameId) => void;
}) {
  const [preview, setPreview] = useState<MenuGameId>(games[0] || "memory");
  const en = !lang.startsWith("tr");
  return (
    <div className="games-lobby">
      <aside className="games-lobby__stage">
        <span className="games-lobby__kicker">
          {en ? "A LITTLE BREAK" : "KÜÇÜK BİR MOLA"}
        </span>
        <h3>
          {en ? "Stay a little." : "Biraz daha"}
          <br />
          <i>{en ? "Play a little." : "kalalım."}</i>
        </h3>
        <p>
          {en
            ? "A solo challenge or a friendly match across the table."
            : "Tek başına bir rekor. Ya da masanın diğer ucuyla küçük bir rekabet."}
        </p>
        <div className="games-lobby__drawing" key={preview}>
          <SahneActivityArt kind={games.length ? preview : "service"} />
          <span>
            {games.length
              ? gameCatalogEntry(preview, lang).title
              : en
                ? "A little break."
                : "Küçük bir mola."}
          </span>
        </div>
        <span className="games-lobby__foot">
          <Gamepad2 size={15} />
          {en ? "Your table. Your playground." : "Bu masada herkese yer var."}
        </span>
      </aside>
      <div className="games-lobby__selection">
        <div className="games-lobby__list-head">
          <span>{en ? "PICK A GAME" : "BİR OYUN SEÇ"}</span>
          <span>{String(games.length).padStart(2, "0")}</span>
        </div>
        {games.map((id, i) => {
          const entry = gameCatalogEntry(id, lang);
          return (
            <button
              key={id}
              type="button"
              className={`games-lobby__game menu-games__tile sh-games__tile--${id} ${preview === id ? "is-preview" : ""}`}
              onPointerEnter={() => setPreview(id)}
              onFocus={() => setPreview(id)}
              onClick={() => onPlay(id)}
            >
              <span className="games-lobby__index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="games-lobby__copy">
                <small>{entry.badge}</small>
                <strong>{entry.title}</strong>
                <span>{entry.blurb}</span>
              </span>
              <span className="games-lobby__arrow">
                <ArrowUpRight size={20} />
              </span>
            </button>
          );
        })}
        {!games.length && (
          <p>
            {en ? "Games are currently unavailable." : "Oyunlar şu an kapalı."}
          </p>
        )}
        <p className="games-lobby__hint">
          {en
            ? "Pick a game. We’ll take care of the rest."
            : "Birini seç, gerisini oyuna bırak."}
        </p>
      </div>
    </div>
  );
}
