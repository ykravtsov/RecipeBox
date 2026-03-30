mod entities;
mod auth;
mod handlers;
mod migration;

use axum::{response::IntoResponse, routing::{get, put}, Router};
use sea_orm::{Database, EntityTrait, ColumnTrait, ActiveModelTrait, QueryFilter, Set};
use sea_orm_migration::MigratorTrait;
use thiserror::Error;
use tower_http::cors::{Any, CorsLayer};

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    SeaOrm(#[from] sea_orm::DbErr),
    #[error("Auth error: {0}")]
    Auth(#[from] crate::auth::AuthError),
    #[error("Bcrypt error: {0}")]
    Bcrypt(#[from] bcrypt::BcryptError),
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("Serde JSON error: {0}")]
    SerdeJson(#[from] serde_json::Error),
    #[error("UUID error: {0}")]
    Uuid(#[from] uuid::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AppError::SeaOrm(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
            AppError::Auth(e) => e.into_response(),
            AppError::Bcrypt(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "Password error").into_response(),
            AppError::Reqwest(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "HTTP error").into_response(),
            AppError::SerdeJson(_) => (axum::http::StatusCode::INTERNAL_SERVER_ERROR, "JSON error").into_response(),
            AppError::Uuid(_) => (axum::http::StatusCode::BAD_REQUEST, "Invalid UUID").into_response(),
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = Database::connect(&database_url).await?;

    // Run migrations
    migration::Migrator::up(&db, None).await?;

    // Seed test user
    let existing = entities::user::Entity::find()
        .filter(entities::user::Column::Email.eq("testuser@example.com"))
        .one(&db)
        .await?;
    if existing.is_none() {
        let password_hash = bcrypt::hash("Test123!", bcrypt::DEFAULT_COST)?;
        let user = entities::user::ActiveModel {
            id: Set(uuid::Uuid::new_v4()),
            email: Set("testuser@example.com".to_string()),
            password_hash: Set(password_hash),
            created_at: Set(chrono::Utc::now()),
        };
        user.insert(&db).await?;
    }

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/auth/register", axum::routing::post(handlers::register))
        .route("/auth/login", axum::routing::post(handlers::login))
        .route("/scrape-recipe", axum::routing::post(handlers::scrape_recipe))
        .route("/recipes", get(handlers::get_recipes).post(handlers::create_recipe))
        .route("/recipes/search", get(handlers::search_recipes))
        .route("/recipes/:id", get(handlers::get_recipe).put(handlers::update_recipe).delete(handlers::delete_recipe))
        .with_state(db)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    println!("Listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}
