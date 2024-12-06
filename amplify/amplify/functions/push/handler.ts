import type { Schema } from "../../data/resource";
import * as ddb from "@aws-appsync/utils/dynamodb";
import { util } from "@aws-appsync/utils";

/* 
For using dynamodb utils in handler
https://docs.aws.amazon.com/appsync/latest/devguide/built-in-modules-js.html

*/
type ChangeRow = {
  assumedMasterState?: {
    updatedAt: string; // or Date, depending on your data structure
  };
  newDocumentState: {
    id: string;
    updatedAt: string; // or Date
    [key: string]: any; // additional fields if any
  };
};
type EventArguments = {
  changeRows: ChangeRow[];
};

type EventDoc = {
  id: number;
  documents: ChangeRow["newDocumentState"][];
  checkpoint: {
    id: string;
    updatedAt: string; // or Date
  } | null;
};

export const handler: Schema["pushMutation"]["functionHandler"] = async (
  event,
  context
) => {
  let lastEventId = 0;
  console.log(event.arguments);
  const { changeRows } = event.arguments;
  const conflicts = [];
  const eventDoc: EventDoc = {
    id: lastEventId++,
    documents: [],
    checkpoint: null,
  };
  if (Array.isArray(changeRows)) {
    for (const row of changeRows) {
      // get data from dynamoDb
      const realMasterState = request(row);
      if (
        (realMasterState && !row.assumedMasterState) ||
        (realMasterState &&
          row.assumedMasterState &&
          /*
           * For simplicity we detect conflicts on the server by only compare the updateAt value.
           * In reality you might want to do a more complex check or do a deep-equal comparison.
           */
          realMasterState.key.updatedAt !== row.assumedMasterState.updatedAt)
      ) {
        // we have a conflict
        conflicts.push(realMasterState);
      } else {
        // no conflict -> write the document
        ddb.put({ key: { id: util.autoId() }, item: row.newDocumentState });
        eventDoc.documents.push(row.newDocumentState);
        eventDoc.checkpoint = {
          id: row.newDocumentState.id,
          updatedAt: row.newDocumentState.updatedAt,
        };
      }
      // Process each row
    }
  } else {
    throw new Error("changeRows is not an array or is undefined.");
  }

  return {
    conflicts: conflicts,
  };
};

export function request(ctx: any) {
  return ddb.get({ key: { id: ctx.newDocumentState.id } });
}
