import { getReadyRuntimePropertyVaultAuth } from "@dabrowskiego/auth"
import { toNextJsHandler } from "better-auth/next-js"

async function resolveHandler() {
  return toNextJsHandler(await getReadyRuntimePropertyVaultAuth())
}

export async function DELETE(request: Request, context: unknown) {
  void context
  return (await resolveHandler()).DELETE(request)
}

export async function GET(request: Request, context: unknown) {
  void context
  return (await resolveHandler()).GET(request)
}

export async function PATCH(request: Request, context: unknown) {
  void context
  return (await resolveHandler()).PATCH(request)
}

export async function POST(request: Request, context: unknown) {
  void context
  return (await resolveHandler()).POST(request)
}

export async function PUT(request: Request, context: unknown) {
  void context
  return (await resolveHandler()).PUT(request)
}
