import type { Handler } from "aws-lambda";
import { MongoClient } from "mongodb";
import type { Schema } from "../../data/resource";

interface Todo {
  id: string;
  name: string;
  done: boolean;
  timestamp: string;
  deleted: boolean;
}

interface TodoInput {
  id: string;
  name: string;
  done: boolean;
  timestamp: string;
  deleted?: boolean;
}

interface Checkpoint {
  id: string;
  updatedAt: string;
}

interface TodoInputPushRow {
  assumedMasterState?: TodoInput;
  newDocumentState: TodoInput;
}

interface TodoPullBulk {
  documents: Todo[];
  checkpoint?: Checkpoint;
}

interface PushResponse {
  conflicts: Todo[];
  conflictMessage: string;
  changes: Todo[];
  changeAction: string[];
}

// In-memory storage for demonstration purposes
// Replace with actual database in production

let lastCheckpoint: Checkpoint = {
  id: "0",
  updatedAt: new Date().toISOString(),
};

const uri: string =
  "mongodb+srv://muhammadalim:BbxtygixchoWzcAL@cluster0.57kx0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Replace with your MongoDB URI
const uri2: string =
  "mongodb+srv://dani:4YcgTMImCCPaVwzM@cluster0.olyde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client: MongoClient = new MongoClient(process.env.MONGODB_URL!);

export const handler: Schema["mongoDb"]["functionHandler"] = async (event) => {
  try {
    const { operation, checkpoint } = event.arguments;
    await client.connect();
    const db = client.db("db-graphql-test");
    const collection = db.collection("todos");

    switch (operation) {
      case "pullTodo":
        return await handlePullTodo(collection, checkpoint);
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await client.close(); // Close the MongoDB connection
  }
};

// Helper function to transform a MongoDB document into a Todo object
function transformDocumentToTodo(doc: any): Todo {
  return {
    id: doc._id.toString(),
    name: doc.name,
    done: doc.done,
    timestamp: doc.timestamp,
    deleted: doc.deleted || false,
  };
}

async function handlePullTodo(
  collection: any,
  checkpoint?: string | null
): Promise<{ documents: Todo[]; checkpoint: any }> {
  let lastCheckpoint: Checkpoint = {
    id: "0",
    updatedAt: new Date().toISOString(),
  };
  const limit = 100; // Fetch 100 documents at a time

  const todosMongoDb = await collection.find({}).limit(limit).toArray();

  const todos: Todo[] = todosMongoDb.map(transformDocumentToTodo);

  return {
    documents: todos.filter((todo) => !todo.deleted),
    checkpoint: lastCheckpoint || checkpoint,
  };
}
