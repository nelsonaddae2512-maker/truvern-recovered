-- AlterTable
ALTER TABLE "TruvernControl" ADD COLUMN     "parentControlId" INTEGER;

-- CreateTable
CREATE TABLE "TruvernControlParameter" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER NOT NULL,
    "oscalId" TEXT NOT NULL,
    "label" TEXT,
    "usage" TEXT,
    "props" JSONB,
    "guidelines" JSONB,
    "constraints" JSONB,
    "selection" JSONB,
    "values" JSONB,
    "remarks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControlParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernControlPart" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER NOT NULL,
    "oscalId" TEXT,
    "name" TEXT NOT NULL,
    "namespace" TEXT,
    "prose" TEXT,
    "parentPartId" INTEGER,
    "props" JSONB,
    "links" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControlPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernControlProperty" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER,
    "partId" INTEGER,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "className" TEXT,
    "namespace" TEXT,
    "uuid" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControlProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernControlLink" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER,
    "partId" INTEGER,
    "href" TEXT NOT NULL,
    "rel" TEXT,
    "text" TEXT,
    "mediaType" TEXT,
    "resourceFragment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControlLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TruvernControlParameter_controlId_idx" ON "TruvernControlParameter"("controlId");

-- CreateIndex
CREATE INDEX "TruvernControlParameter_oscalId_idx" ON "TruvernControlParameter"("oscalId");

-- CreateIndex
CREATE UNIQUE INDEX "TruvernControlParameter_controlId_oscalId_key" ON "TruvernControlParameter"("controlId", "oscalId");

-- CreateIndex
CREATE INDEX "TruvernControlPart_controlId_idx" ON "TruvernControlPart"("controlId");

-- CreateIndex
CREATE INDEX "TruvernControlPart_parentPartId_idx" ON "TruvernControlPart"("parentPartId");

-- CreateIndex
CREATE INDEX "TruvernControlPart_name_idx" ON "TruvernControlPart"("name");

-- CreateIndex
CREATE INDEX "TruvernControlPart_oscalId_idx" ON "TruvernControlPart"("oscalId");

-- CreateIndex
CREATE INDEX "TruvernControlProperty_controlId_idx" ON "TruvernControlProperty"("controlId");

-- CreateIndex
CREATE INDEX "TruvernControlProperty_partId_idx" ON "TruvernControlProperty"("partId");

-- CreateIndex
CREATE INDEX "TruvernControlProperty_name_idx" ON "TruvernControlProperty"("name");

-- CreateIndex
CREATE INDEX "TruvernControlProperty_namespace_idx" ON "TruvernControlProperty"("namespace");

-- CreateIndex
CREATE INDEX "TruvernControlLink_controlId_idx" ON "TruvernControlLink"("controlId");

-- CreateIndex
CREATE INDEX "TruvernControlLink_partId_idx" ON "TruvernControlLink"("partId");

-- CreateIndex
CREATE INDEX "TruvernControlLink_rel_idx" ON "TruvernControlLink"("rel");

-- CreateIndex
CREATE INDEX "TruvernControlLink_href_idx" ON "TruvernControlLink"("href");

-- CreateIndex
CREATE INDEX "TruvernControl_parentControlId_idx" ON "TruvernControl"("parentControlId");

-- AddForeignKey
ALTER TABLE "TruvernControl" ADD CONSTRAINT "TruvernControl_parentControlId_fkey" FOREIGN KEY ("parentControlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlParameter" ADD CONSTRAINT "TruvernControlParameter_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlPart" ADD CONSTRAINT "TruvernControlPart_parentPartId_fkey" FOREIGN KEY ("parentPartId") REFERENCES "TruvernControlPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlPart" ADD CONSTRAINT "TruvernControlPart_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlProperty" ADD CONSTRAINT "TruvernControlProperty_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlProperty" ADD CONSTRAINT "TruvernControlProperty_partId_fkey" FOREIGN KEY ("partId") REFERENCES "TruvernControlPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlLink" ADD CONSTRAINT "TruvernControlLink_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlLink" ADD CONSTRAINT "TruvernControlLink_partId_fkey" FOREIGN KEY ("partId") REFERENCES "TruvernControlPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
