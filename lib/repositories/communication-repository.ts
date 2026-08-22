import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type CommunicationClient = Pick<
  Prisma.TransactionClient,
  "communicationMailbox" | "communicationMessage" | "communicationConversation"
>;

export async function findCommunicationMailbox<
  T extends Prisma.CommunicationMailboxFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationMailboxFindFirstArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationMailboxGetPayload<T> | null
> {
  return client.communicationMailbox.findFirst(args);
}

export async function findCommunicationMessages<
  T extends Prisma.CommunicationMessageFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationMessageFindManyArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationMessageGetPayload<T>[]
> {
  return client.communicationMessage.findMany(args);
}

export async function findFirstCommunicationMessage<
  T extends Prisma.CommunicationMessageFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationMessageFindFirstArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationMessageGetPayload<T> | null
> {
  return client.communicationMessage.findFirst(args);
}

export async function createCommunicationMessage<
  T extends Prisma.CommunicationMessageCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationMessageCreateArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationMessageGetPayload<T>
> {
  return client.communicationMessage.create(args);
}

export async function findFirstCommunicationConversation<
  T extends Prisma.CommunicationConversationFindFirstArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationConversationFindFirstArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationConversationGetPayload<T> | null
> {
  return client.communicationConversation.findFirst(args);
}

export async function createCommunicationConversation<
  T extends Prisma.CommunicationConversationCreateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationConversationCreateArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationConversationGetPayload<T>
> {
  return client.communicationConversation.create(args);
}

export async function deleteCommunicationConversation<
  T extends Prisma.CommunicationConversationDeleteArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationConversationDeleteArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationConversationGetPayload<T>
> {
  return client.communicationConversation.delete(args);
}

export async function updateCommunicationConversation<
  T extends Prisma.CommunicationConversationUpdateArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.CommunicationConversationUpdateArgs
  >,
  client: CommunicationClient = prisma,
): Promise<
  Prisma.CommunicationConversationGetPayload<T>
> {
  return client.communicationConversation.update(args);
}
