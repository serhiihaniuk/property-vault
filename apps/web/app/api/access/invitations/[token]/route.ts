import {
  createAccessInvitationAcceptHandler,
  createAccessInvitationGetHandler,
} from "../../../_lib/access-handlers";

export const GET = createAccessInvitationGetHandler();
export const POST = createAccessInvitationAcceptHandler();
