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
        manager
            .alter_table(
                Table::alter()
                    .table(Alias::new("recipes"))
                    .add_column(
                        ColumnDef::new(Alias::new("user_id"))
                            .uuid()
                            .not_null(),
                    )
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