import { useState, useEffect } from "react";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { addRxPlugin } from "rxdb";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
// Define the schema outside the hook for reusability
const todoSchema = {
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100, // <- the primary key must have set maxLength
    },
    name: {
      type: "string",
    },
    done: {
      type: "boolean",
    },
    timestamp: {
      type: "string",
      format: "date-time",
    },
  },
  required: ["id", "name", "done", "timestamp"],
};

function useInitDatabase() {
  const [db, setDb] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const createDb = async () => {
    const connectDb = await createRxDatabase({
      name: "rxdb-sample",
      //   storage: getRxStorageMemory(),
      storage: getRxStorageDexie(),
      ignoreDuplicate: true,
    });
    await connectDb.addCollections({
      todos: {
        schema: todoSchema,
      },
    });

    setDb(connectDb);
  };

  const checkLeader = async () => {
    // Check for leader election
    db.waitForLeadership().then(() => {
      console.log("Long lives the king!"); // <- runs when db becomes leader
      setIsLeader(true);
    });

    // const currentLeader = await db.getLeader();
    // console.log("Current Leader:", currentLeader);
  };

  useEffect(() => {
    createDb();
  }, []);

  useEffect(() => {
    if (db) {
      checkLeader();
    }
  }, [db]);

  return { db, isLeader };
}

export default useInitDatabase;
