use sea_orm_migration::prelude::*;
use sea_orm_migration::MigrationName;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(CreateUsersTable),
            Box::new(CreateRecipesTable),
            Box::new(AddUserIdToRecipesTable),
            Box::new(AddRecipeFields),
        ]
    }
}

pub struct CreateUsersTable;

impl MigrationName for CreateUsersTable {
    fn name(&self) -> &str {
        "m20240101000000_create_users_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for CreateUsersTable {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("users"))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("email"))
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("password_hash"))
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("created_at"))
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Alias::new("users")).to_owned())
            .await
    }
}

pub struct CreateRecipesTable;

impl MigrationName for CreateRecipesTable {
    fn name(&self) -> &str {
        "m20240101000001_create_recipes_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for CreateRecipesTable {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Alias::new("recipes"))
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Alias::new("id"))
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("title"))
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("ingredients"))
                            .json()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("instructions"))
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Alias::new("created_at"))
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Alias::new("recipes")).to_owned())
            .await
    }
}

pub struct AddUserIdToRecipesTable;

impl MigrationName for AddUserIdToRecipesTable {
    fn name(&self) -> &str {
        "m20240101000002_add_user_id_to_recipes_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for AddUserIdToRecipesTable {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let fk = TableForeignKey::new()
            .name("fk_recipes_user_id")
            .from_tbl(Alias::new("recipes"))
            .from_col(Alias::new("user_id"))
            .to_tbl(Alias::new("users"))
            .to_col(Alias::new("id"))
            .on_delete(ForeignKeyAction::Cascade)
            .on_update(ForeignKeyAction::Cascade)
            .to_owned();
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("recipes"))
                    .add_column(
                        ColumnDef::new(Alias::new("user_id"))
                            .uuid()
                            .not_null(),
                    )
                    .add_foreign_key(&fk)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("recipes"))
                    .drop_column(Alias::new("user_id"))
                    .to_owned(),
            )
            .await
    }
}

pub struct AddRecipeFields;

impl MigrationName for AddRecipeFields {
    fn name(&self) -> &str {
        "m20240101000003_add_recipe_fields"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for AddRecipeFields {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        // Use IF NOT EXISTS for idempotent column additions
        db.execute_unprepared(
            "ALTER TABLE recipes \
             ADD COLUMN IF NOT EXISTS description VARCHAR, \
             ADD COLUMN IF NOT EXISTS image_url VARCHAR, \
             ADD COLUMN IF NOT EXISTS tags JSONB, \
             ADD COLUMN IF NOT EXISTS prep_time INTEGER, \
             ADD COLUMN IF NOT EXISTS cook_time INTEGER"
        ).await?;
        // Rename instructions -> steps only if instructions column exists
        db.execute_unprepared(
            "DO $$ BEGIN \
               IF EXISTS (SELECT 1 FROM information_schema.columns \
                          WHERE table_name='recipes' AND column_name='instructions') THEN \
                 ALTER TABLE recipes RENAME COLUMN instructions TO steps; \
               END IF; \
             END $$"
        ).await?;
        // Change steps column type to JSONB if it's not already
        db.execute_unprepared(
            "DO $$ BEGIN \
               IF EXISTS (SELECT 1 FROM information_schema.columns \
                          WHERE table_name='recipes' AND column_name='steps' \
                          AND data_type != 'jsonb') THEN \
                 ALTER TABLE recipes ALTER COLUMN steps TYPE JSONB USING steps::jsonb; \
               END IF; \
             END $$"
        ).await?;
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("recipes"))
                    .drop_column(Alias::new("description"))
                    .drop_column(Alias::new("image_url"))
                    .drop_column(Alias::new("tags"))
                    .drop_column(Alias::new("prep_time"))
                    .drop_column(Alias::new("cook_time"))
                    .rename_column(Alias::new("steps"), Alias::new("instructions"))
                    .to_owned(),
            )
            .await
    }
}
