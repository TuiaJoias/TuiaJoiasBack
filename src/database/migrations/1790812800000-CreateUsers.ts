import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1790812800000 implements MigrationInterface {
  name = 'CreateUsers1790812800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
        "name" character varying(120) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
