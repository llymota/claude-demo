import { useCallback, useEffect, useMemo, useState } from "react";
import { archive, conversations, people, profile, weeklyFollows } from "./data/seed";
import { useRoute, type Route } from "./lib/route";
import { nudges, rankRooms } from "./lib/scoring";
import { useTendril } from "./lib/store";
import { Avatar, Icon, Logo } from "./components/icons";
import { Landing } from "./screens/Landing";
import { Today } from "./screens/Today";
import { Rooms } from "./screens/Rooms";
import { Circles } from "./screens/Circles";
import { SecondLife } from "./screens/SecondLife";
import { Storefront } from "./screens/Storefront";
import { Ledger } from "./screens/Ledger";

export interface Workspace {
  profile: typeof profile;
  people: typeof people;
  archive: typeof archive;
  weeklyFollows: typeof weeklyFollows;
  rooms: ReturnType<typeof rankRooms>;
  nudges: ReturnType<typeof nudges>;
}

export default function App() {
  const route = useRoute();
  const tendril = useTendril();
  const [toast, setToast] = useState<string | null>(null);
  const [focusRoom, setFocusRoom] = useState<string | null>(null);

  const ws: Workspace = useMemo(
    () => ({
      profile,
      people,
      archive,
      weeklyFollows,
      rooms: rankRooms(conversations, profile, people),
      nudges: nudges(people),
    }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = useCallback((msg: string) => setToast(msg), []);
  const openRoom = useCallback((id: string) => {
    setFocusRoom(id);
    window.location.hash = "rooms";
  }, []);

  if (route === "welcome") {
    return (
      <>
        <Landing />
        {toast && <div className="toast" role="status">{toast}</div>}
      </>
    );
  }

  const openRooms = ws.rooms.filter((r) => !tendril.state.replied.includes(r.conversation.id)).length;
  const nav: { id: Route; label: string; icon: () => JSX.Element; count?: number }[] = [
    { id: "today", label: "Today", icon: Icon.today },
    { id: "rooms", label: "Rooms", icon: Icon.rooms, count: openRooms },
    { id: "circles", label: "Circles", icon: Icon.circles, count: ws.nudges.length },
    { id: "second-life", label: "Second Life", icon: Icon.secondLife },
    { id: "storefront", label: "Storefront", icon: Icon.storefront },
    { id: "ledger", label: "Ledger", icon: Icon.ledger },
  ];

  return (
    <div className="shell">
      <aside className="rail">
        <a className="brand" href="#welcome">
          <Logo /> Tendril
        </a>
        <nav className="nav" aria-label="Workspace">
          {nav.map((n) => (
            <a key={n.id} href={`#${n.id}`} aria-current={route === n.id ? "page" : undefined}>
              <n.icon />
              <span>{n.label}</span>
              {n.count ? <span className="count">{n.count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="account">
            <Avatar name={ws.profile.name} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>{ws.profile.name}</div>
              <div className="muted">@{ws.profile.handle}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn small ghost"
            style={{ justifyContent: "flex-start" }}
            onClick={() => {
              tendril.reset();
              notify("Demo workspace reset");
            }}
          >
            Reset demo
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="demo-banner">
          <strong>Demo workspace.</strong> Priya Raman and everyone in her network are invented. Nothing here posts anywhere.
        </div>
        {route === "today" && <Today ws={ws} tendril={tendril} openRoom={openRoom} notify={notify} />}
        {route === "rooms" && <Rooms ws={ws} tendril={tendril} focus={focusRoom} setFocus={setFocusRoom} notify={notify} />}
        {route === "circles" && <Circles ws={ws} tendril={tendril} notify={notify} />}
        {route === "second-life" && <SecondLife ws={ws} openRoom={openRoom} notify={notify} />}
        {route === "storefront" && <Storefront ws={ws} tendril={tendril} />}
        {route === "ledger" && <Ledger ws={ws} />}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
