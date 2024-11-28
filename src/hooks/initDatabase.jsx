import { useState, useEffect } from "react";
import { createRxDatabase } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { addRxPlugin } from "rxdb";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { RxDBCleanupPlugin } from "rxdb/plugins/cleanup";
import { RxDBBackupPlugin } from "rxdb/plugins/backup";
import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";
import { RxDBLocalDocumentsPlugin } from "rxdb/plugins/local-documents";
addRxPlugin(RxDBLocalDocumentsPlugin);
addRxPlugin(RxDBBackupPlugin);

addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBCleanupPlugin);

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
  encrypted: ["name"],
};

function useInitDatabase() {
  const [db, setDb] = useState(null);
  const [isLeader, setIsLeader] = useState(false);

  // wrap the normal storage with the encryption plugin
  const encryptedDexieStorage = wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie(),
  });

  const createDb = async () => {
    const connectDb = await createRxDatabase({
      name: "rxdb-sample",
      //   storage: getRxStorageMemory(),
      //storage: getRxStorageDexie(),
      storage: encryptedDexieStorage,
      password: "sudoLetMeIn",
      ignoreDuplicate: true,
      localDocuments: true,
      cleanupPolicy: {
        /**
         * The minimum time in milliseconds for how long
         * a document has to be deleted before it is
         * purged by the cleanup.
         * [default=one month]
         */
        minimumDeletedTime: 1000 * 60, // one month,
        /**
         * The minimum amount of that that the RxCollection must have existed.
         * This ensures that at the initial page load, more important
         * tasks are not slowed down because a cleanup process is running.
         * [default=60 seconds]
         */
        minimumCollectionAge: 1000 * 60, // 60 seconds
        /**
         * After the initial cleanup is done,
         * a new cleanup is started after [runEach] milliseconds
         * [default=5 minutes]
         */
        runEach: 1000 * 60 * 5, // 5 minutes
        /**
         * If set to true,
         * RxDB will await all running replications
         * to not have a replication cycle running.
         * This ensures we do not remove deleted documents
         * when they might not have already been replicated.
         * [default=true]
         */
        awaitReplicationsInSync: true,
        /**
         * If true, it will only start the cleanup
         * when the current instance is also the leader.
         * This ensures that when RxDB is used in multiInstance mode,
         * only one instance will start the cleanup.
         * [default=true]
         */
        waitForLeadership: true,
      },
    });
    await connectDb.addCollections({
      todos: {
        schema: todoSchema,
        localDocuments: true,
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
