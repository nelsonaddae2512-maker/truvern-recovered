import { vi } from "vitest";

type AsyncDatabaseMock = ReturnType<
  typeof vi.fn<(...args: unknown[]) => Promise<unknown>>
>;

type TransactionMock = ReturnType<
  typeof vi.fn<
    (
      input:
        | ((client: PrismaTestDouble) => unknown)
        | readonly unknown[]
        | unknown,
    ) => Promise<unknown>
  >
>;

export type PrismaTestDouble = {
  $queryRawUnsafe: AsyncDatabaseMock;
  $executeRawUnsafe: AsyncDatabaseMock;
  $transaction: TransactionMock;
};

export function createPrismaTestDouble(): PrismaTestDouble {
  const queryRawUnsafe = vi.fn<
    (...args: unknown[]) => Promise<unknown>
  >(async () => []);

  const executeRawUnsafe = vi.fn<
    (...args: unknown[]) => Promise<unknown>
  >(async () => 0);

  const transaction = vi.fn<
    (
      input:
        | ((client: PrismaTestDouble) => unknown)
        | readonly unknown[]
        | unknown,
    ) => Promise<unknown>
  >();

  const testDouble: PrismaTestDouble = {
    $queryRawUnsafe: queryRawUnsafe,
    $executeRawUnsafe: executeRawUnsafe,
    $transaction: transaction,
  };

  transaction.mockImplementation(async (input) => {
    if (typeof input === "function") {
      return input(testDouble);
    }

    if (Array.isArray(input)) {
      return Promise.all(input);
    }

    return input;
  });

  return testDouble;
}
