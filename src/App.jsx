import { useEffect, useState } from "react";
import "./App.css";
import { replicateGraphQL } from "rxdb/plugins/replication-graphql";
import { Subject } from "rxjs";
import initDatabase from "./hooks/initDatabase";
import { EventSourcePolyfill } from "event-source-polyfill";

const initialState = {
  name: "",
  done: false,
  timestamp: +new Date(),
};

// url server dani
const urlDani = {
  pull: "https://ca99-103-81-220-21.ngrok-free.app/pull",
  push: "https://ca99-103-81-220-21.ngrok-free.app/push",
  stream: "https://ca99-103-81-220-21.ngrok-free.app/pullStream",
};

// url data
const urlSort = {
  pull: "https://sort.my.id/rxdb/pull",
  push: "https://sort.my.id/rxdb/push",
  stream: "https://sort.my.id/rxdb/pull_stream",
  login: "https://sort.my.id/login",
};

const urlGraphql = {
  url: "https://cqsfixpczfdyzblgvmdjctaguq.appsync-api.us-west-2.amazonaws.com/graphql",
  wss: "wss://cqsfixpczfdyzblgvmdjctaguq.appsync-realtime-api.us-west-2.amazonaws.com/graphql",
  token: "da2-pimvzxbgmbdo5ddqooc3p7veqe",
};
// user data
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
  const [myPullStream] = useState(() => new Subject());

  const { db, isLeader } = initDatabase();

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
    await db.todos.insertLocal("foobar", {
      foo: "bar",
    });
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

  const pullQueryBuilder = () => {
    const query = `query PullTodos {
pullTodo{
    checkpoint {
      updatedAt
      id
    }
    documents {
      deleted
      done
      id
      name
      timestamp
    }
  }
}`;
    return {
      query,
      operationName: "PullTodos",
      variables: null,
    };
  };

  const pushMutationBuilder = (rows) => {
    // Ensure rows is always an array
    const rowsArray = Array.isArray(rows) ? rows : [rows];

    const query = `mutation PushTodo($writeRows: [TodoInputPushRow!]!) {
      pushTodo(rows: $writeRows) {
        id
        name
        done
        timestamp
      }
    }`;

    const variables = {
      writeRows: rowsArray, // Use the wrapped array
    };

    return {
      query,
      operationName: "PushTodo",
      variables,
    };
  };

  const streamTodoBuilder = () => {
    const query = `subscription StreamTodo {
    streamTodo {
    checkpoint {
      id
      updatedAt
    }
    documents {
      deleted
      done
      id
      name
      timestamp
    }
  }    
  }`;
    return {
      query,
      operationName: "StreamTodo",
      variables: null,
    };
  };

  const replication = async () => {
    if (!db) return;

    const replicateState = await replicateGraphQL({
      collection: db.todos,
      url: {
        http: urlGraphql.url,
        ws: urlGraphql.wss,
      },
      push: {
        queryBuilder: pushMutationBuilder,
      },
      headers: {
        "x-api-key": urlGraphql.token,
      },
      pull: {
        queryBuilder: pullQueryBuilder,
        streamBuilder: streamTodoBuilder,
        includeWsHeaders: true,
        wsOptions: {
          retryAttempts: 10,
        },
      },
      deletedField: "deleted",
      live: true,
    });

    // emits each document that was received from the remote
    replicateState.received$.subscribe((doc) => console.dir(doc));

    // emits each document that was send to the remote
    replicateState.sent$.subscribe((doc) => console.dir(doc));

    // emits all errors that happen when running the push- & pull-handlers.
    replicateState.error$.subscribe((error) => console.dir(error));
  };

  const getReplica = async () => {
    replication();
  };

  useEffect(() => {
    subscribe();
    getReplica();
  }, [db]);

  const handleLogout = async () => {
    await db.todos.cleanup(100);
    setData([]);
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
  };

  const handleCleanUp = async () => {
    console.log("cleaning up data-------");
    await db.todos.cleanup();
  };

  // Can only be use for server side
  // const handleBackupData = async () => {
  //   console.log("Backup data------");
  //   const backupOptions = {
  //     // if false, a one-time backup will be written
  //     live: false,
  //     // the folder where the backup will be stored
  //     directory: "/backup/",
  //     // if true, attachments will also be saved
  //     attachments: true,
  //   };
  //   const backupState = db.backup(backupOptions);
  //   await backupState.awaitInitialBackup();
  // };

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
        {/* <span> */}
        {/*   <button onClick={() => handleLogin(user[0])}>Login-{user[0]}</button> */}
        {/* </span> */}
        {/* <span> */}
        {/*   <button onClick={() => handleLogin(user[1])}>Login-{user[1]}</button> */}
        {/* </span> */}
        {/* <span> */}
        {/*   <button onClick={() => handleLogin(user[2])}>Login-{user[2]}</button> */}
        {/* </span> */}
        {/* <span> */}
        {/*   <button onClick={handleLogout}>Logout</button> */}
        {/* </span> */}
        <br />
        <span>
          <button onClick={() => handleCleanUp()}>Clean up!</button>
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
              <span style={{ padding: 10 }}>
                {item.name} - {item.done}
              </span>
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
