import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type NotificationClient = Pick<
  Prisma.TransactionClient,
  "notification"
>;

export async function createNotifications<
  T extends Prisma.NotificationCreateManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.NotificationCreateManyArgs
  >,
  client: NotificationClient = prisma,
) {
  return client.notification.createMany(args);
}

export async function findNotifications<
  T extends Prisma.NotificationFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.NotificationFindManyArgs>,
  client: NotificationClient = prisma,
): Promise<Prisma.NotificationGetPayload<T>[]> {
  return client.notification.findMany(args);
}

export async function findFirstNotification<
  T extends Prisma.NotificationFindFirstArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.NotificationFindFirstArgs>,
  client: NotificationClient = prisma,
): Promise<Prisma.NotificationGetPayload<T> | null> {
  return client.notification.findFirst(args);
}

export async function updateNotifications(
  args: Prisma.NotificationUpdateManyArgs,
  client: NotificationClient = prisma,
) {
  return client.notification.updateMany(args);
}

export async function deleteNotifications(
  args: Prisma.NotificationDeleteManyArgs,
  client: NotificationClient = prisma,
) {
  return client.notification.deleteMany(args);
}

export async function countNotifications(
  args: Prisma.NotificationCountArgs,
  client: NotificationClient = prisma,
) {
  return client.notification.count(args);
}
