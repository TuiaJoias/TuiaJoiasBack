import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWorks1790812800200 implements MigrationInterface {
  name = 'CreateWorks1790812800200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "works" (
        "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
        "title" character varying(120) NOT NULL,
        "description" character varying(160),
        "category_id" integer NOT NULL,
        "image_url" text NOT NULL,
        "storage_path" character varying(255) NOT NULL,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "is_favorite" boolean NOT NULL DEFAULT false,
        "is_published" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_works_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_works_storage_path" UNIQUE ("storage_path"),
        CONSTRAINT "CHK_works_position_positive" CHECK ("position" > 0),
        CONSTRAINT "FK_works_category_id" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_works_category_id" ON "works" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_works_is_published_position" ON "works" ("is_published", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_works_position" ON "works" ("position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "works"`);
  }
}
