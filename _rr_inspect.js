const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    const rr = await p.reviewRequest.findFirst({
      where: { id: 1 },
      select: {
        id: true,
        organizationId: true,
        vendorId: true,
        templateId: true,
        templateSnapshot: true,
        template: {
          select: {
            id: true,
            publishedAt: true,
            publishedStructure: true,
            structure: true,
            draftStructure: true,
          },
        },
      },
    });

    console.log(JSON.stringify(rr, null, 2));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
