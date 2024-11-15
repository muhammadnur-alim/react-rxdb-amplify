import { useEffect, useState } from "react";
import "./App.css";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { Subject } from "rxjs";
import initDatabase from "./hooks/initDatabase";
import { EventSourcePolyfill } from "event-source-polyfill";

const initialState = {
  name: "",
  done: false,
  timestamp: +new Date(),
};

const urlDani = {
  pull: "https://ca99-103-81-220-21.ngrok-free.app/pull",
  push: "https://ca99-103-81-220-21.ngrok-free.app/push",
  stream: "https://ca99-103-81-220-21.ngrok-free.app/pullStream",
};

const urlSort = {
  pull: "https://sort.my.id/rxdb/pull",
  push: "https://sort.my.id/rxdb/push",
  stream: "https://sort.my.id/rxdb/pull_stream",
  login: "https://sort.my.id/login",
};
const user = [
  "sharkpos.course@gmail.com",
  "irfanfandi38@gmail.com",
  "dea.edria@gmail.com",
];

const urlDev = !urlDani ? urlDani : urlSort;

function App() {
  const [show, setSHow] = useState(true);
  const [data, setData] = useState([]);
  const [formState, setFormState] = useState(initialState);
  const [formupdate, setFormUpdate] = useState(initialState);
  const [myPullStream] = useState(new Subject());

  const { db, isLeader } = initDatabase();
  console.log(isLeader);

  function setInput(key, value) {
    setFormState({ ...formState, [key]: value });
  }

  function setInputUpdate(key, value) {
    setFormUpdate({ ...formupdate, [key]: value });
  }

  const createData = async () => {
    if (!db) return;

    formState.id = (+new Date()).toString();
    await db.todos.insert(formState);
    setFormState(initialState);
  };

  const handleCLickUpdate = (data) => {
    setFormUpdate({
      id: data.id,
      name: data.name,
    });
    setSHow(false);
  };

  const updateData = async () => {
    if (!db) return;

    setSHow(true);

    const query = db.todos.find({
      selector: {
        id: formupdate.id,
      },
    });
    await query.patch({
      name: formupdate.name,
    });
  };

  const subscribe = async () => {
    if (!db) return;
    const query = db.todos.find();
    const querySub = query.$.subscribe((results) => {
      setData(results);
    });
    // stop watching this query
    return () => {
      querySub.unsubscribe();
    };
  };

  const handleDelete = async (data) => {
    if (!db) return;

    const query = db.todos.find({
      selector: {
        id: data.id,
      },
    });
    await query.remove();
  };

  const handleDetail = async (data) => {
    if (!db) return;

    const doc = await db.todos.findOne(data.id).exec();
    console.log(doc);

    const name = await doc.populate("name");
    console.log(name);
  };

  const createEventSource = () => {
    const tokenJwt = JSON.parse(localStorage.getItem("token"));
    const eventSource = new EventSourcePolyfill(urlDev.stream, {
      headers: {
        Authorization: tokenJwt.jwt,
      },
    });

    eventSource.addEventListener("message", (event) => {
      const eventData = JSON.parse(event.data);
      myPullStream.next({
        documents: eventData.documents,
        checkpoint: eventData.checkpoint,
      });
    });

    eventSource.addEventListener("error", () => myPullStream.next("RESYNC"));
  };

  const replication = () => {
    if (!db) return;

    replicateRxCollection({
      collection: db.todos,
      push: {
        async handler(body) {
          const response = await fetch(urlDev.push, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: localStorage.getItem("token"),
            },
            body: JSON.stringify(body),
          });

          const data = await response.json();
          return data;
        },
      },
      pull: {
        async handler(lastCheckpoint, batchSize) {
          const response = await fetch(urlDev.pull, {
            headers: {
              Authorization: localStorage.getItem("token"),
            },
          });
          const data = await response.json();
          return {
            documents: data.documents,
            checkpoint: data.checkpoint,
          };
        },
        stream$: myPullStream.asObservable(),
      },
    });
  };

  const getReplica = async () => {
    replication();
  };

  useEffect(() => {
    subscribe();
    getReplica();
  }, [db]);

  const handleLogout = () => {
    localStorage.removeItem("token");
  };

  const handleLogin = async (user) => {
    const body = {
      username: user,
    };
    const response = await fetch(urlDev.login, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const { data } = await response.json();
    const dataResponse = JSON.stringify(data);
    localStorage.setItem("token", dataResponse);
    createEventSource();
  };

  useEffect(() => {
    const defaultIconUrl = "/vite.svg";
    const leaderIconUrl = "/crownicon.svg";
    const favicon =
      document.querySelector("link[rel='icon']") ||
      document.createElement("link");
    favicon.rel = "icon";
    favicon.href = isLeader ? leaderIconUrl : defaultIconUrl;

    // Append favicon if it wasn't already in the DOM
    if (!favicon.parentNode) {
      document.head.appendChild(favicon);
    }

    // Cleanup on unmount
    return () => {
      favicon.href = defaultIconUrl;
    };
  }, [isLeader]);

  if (!db) {
    return <div>Loading database...</div>;
  }

  return (
    <>
      <div>
        <span>
          <button onClick={() => handleLogin(user[0])}>Login-{user[0]}</button>
        </span>
        <span>
          <button onClick={() => handleLogin(user[1])}>Login-{user[1]}</button>
        </span>
        <span>
          <button onClick={() => handleLogin(user[2])}>Login-{user[2]}</button>
        </span>
        <span>
          <button onClick={handleLogout}>Logout</button>
        </span>
      </div>
      <div>
        <a href="#" target="_blank">
          <img
            src="https://rxdb.info/files/logo/logo.svg"
            className="logo react"
            alt="React logo"
          />
        </a>
      </div>

      {show ? (
        <div>
          <input
            type="text"
            value={formState.name}
            onChange={(e) => setInput("name", e.target.value)}
          />
          <button onClick={() => createData()}>Submit</button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={formupdate.name}
            onChange={(e) => setInputUpdate("name", e.target.value)}
          />
          <button onClick={() => updateData()}>Update</button>
        </div>
      )}

      {data &&
        data.length > 0 &&
        data.map((item) => {
          return (
            <div key={item.id} style={{ margin: 5 }}>
              <span style={{ padding: 10 }}>{item.name}</span>
              <span>
                <button onClick={() => handleCLickUpdate(item)}>update</button>
              </span>
              <span>
                <button onClick={() => handleDetail(item)}>detail</button>
              </span>
              <span>
                <button onClick={() => handleDelete(item)}>delete</button>
              </span>
            </div>
          );
        })}
    </>
  );
}

export default App;
