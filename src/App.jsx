import { useEffect, useState } from "react";
import "./App.css";
import initDatabase from "./hooks/initDatabase";
import Modal from "./Modal";
import { replicateRxCollection } from "rxdb/plugins/replication";
import { generateClient } from "aws-amplify/data";
import { Subject } from "rxjs";

const initialState = {
  name: "",
  done: false,
  timestamp: +new Date(),
};

const client = generateClient();

function App() {
  const [show, setSHow] = useState(true);
  const [data, setData] = useState([]);
  const [formState, setFormState] = useState(initialState);
  const [formupdate, setFormUpdate] = useState(initialState);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState("");

  const { db, isLeader } = initDatabase();

  /**
   * Fetches data from the specified model and optionally processes it with a callback.
   *
   * @param {string} model - The name of the model to fetch data from. Should match a key in `client.models`.
   * @param {Function} [callback] - Optional callback function to process the fetched data.
   * @returns {Promise<void>} A promise that resolves when the fetch operation is complete.
   */
  const fetchTodos = async () => {
    try {
      const { data, errors } = await client.models.Todos.list();
      if (errors) {
        console.error(`Error fetching:`, errors);
      } else {
        return data;
      }
    } catch (error) {
      console.error(`Unexpected error fetching:`, error);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

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

  // const createTodo = async () => {
  //   await client.models.Todos.create({
  //     name: `alim_${new Date().toISOString()}`, // Combining 'lim' with the current ISO string
  //     done: false, // Boolean field to indicate completion
  //     timestamp: new Date().toISOString(), // ISO 8601 date-time format
  //     deleted: false, // Boolean field to indicate soft deletion
  //   });
  // };

  const replication = async () => {
    if (!db) return;

    const replicateState = replicateRxCollection({
      collection: db.todos,
      replicationIdentifier: "amplify-http",
      push: {
        /* add settings from below */
        async handler(changeRows) {
          const { data: conflicts } = await client.mutations.pushMutation({
            changeRows: changeRows,
          });
          return conflicts;
        },
      },
      pull: {
        /* add settings from below */
        async handler(checkpointOrNull, batchSize) {
          const { data } = await client.models.Todos.list();
          console.log(data, "pulltodos");
          return {
            documents: data,
            checkpoint: data.updatedAt,
          };
        },
      },
    });

    // emits each document that was received from the remote
    replicateState.received$.subscribe((doc) => {
      setModalContent(`Document sent: ${JSON.stringify(doc)}`);
      setModalOpen(true);
    });

    // emits each document that was send to the remote
    // replicateState.sent$.subscribe((doc) => {
    //   setModalContent(`Document sent: ${JSON.stringify(doc)}`);
    //   setModalOpen(true);
    // });

    // emits all errors that happen when running the push- & pull-handlers.
    // replicateState.error$.subscribe((error) => console.dir(error));
  };

  const getReplica = async () => {
    replication();
  };

  useEffect(() => {
    subscribe();
    getReplica();
  }, [db]);

  // const handleLogout = async () => {
  //   await db.todos.cleanup(100);
  //   setData([]);
  // };

  // const handleLogin = async (user) => {
  //   const body = {
  //     username: user,
  //   };
  //   const response = await fetch(urlDev.login, {
  //     method: "POST",
  //     headers: {
  //       Accept: "application/json",
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify(body),
  //   });

  //   const { data } = await response.json();
  //   const dataResponse = JSON.stringify(data);
  //   localStorage.setItem("token", dataResponse);
  // };

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

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalContent("");
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
      <div onClick={handleCloseModal}>
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

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        content={modalContent}
      />

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
