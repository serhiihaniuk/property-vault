import { getRuntimePropertyVaultAuth } from "@dabrowskiego/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(getRuntimePropertyVaultAuth());

export const { DELETE, GET, PATCH, POST, PUT } = handler;
