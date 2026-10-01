import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories1790812800100 implements MigrationInterface {
  name = 'CreateCategories1790812800100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
        "name" character varying(80) NOT NULL,
        "slug" character varying(80) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
