use axum::{extract::{Path, State}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use crate::auth::{generate_jwt, Claims};
use crate::entities::{self, Ingredient};

#[derive(serde::Deserialize)]
pub struct CreateRecipe {
    pub title: String,
    pub ingredients: Vec<Ingredient>,
    pub steps: Vec<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
    pub prep_time: Option<i32>,
    pub cook_time: Option<i32>,
}

#[derive(serde::Serialize)]
pub struct RecipeResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub ingredients: Vec<Ingredient>,
    pub steps: Vec<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
    pub prep_time: Option<i32>,
    pub cook_time: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_recipes(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
) -> Result<Json<Vec<RecipeResponse>>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let recipes = entities::Entity::find()
        .filter(entities::Column::UserId.eq(user_id))
        .all(&db)
        .await?;
    let responses: Vec<RecipeResponse> = recipes.into_iter().map(|model| -> Result<RecipeResponse, sea_orm::DbErr> {
        let ingredients: Vec<Ingredient> = serde_json::from_value(model.ingredients)
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
        let steps: Vec<String> = serde_json::from_value(model.steps)
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
        let tags: Option<Vec<String>> = model.tags.map(|t| serde_json::from_value::<Vec<String>>(t)
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))).transpose()?;
        Ok(RecipeResponse {
            id: model.id,
            user_id: model.user_id,
            title: model.title,
            ingredients,
            steps,
            description: model.description,
            image_url: model.image_url,
            tags,
            prep_time: model.prep_time,
            cook_time: model.cook_time,
            created_at: model.created_at,
        })
    }).collect::<Result<Vec<_>, _>>()?;
    Ok(Json(responses))
}

pub async fn get_recipe(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    Path(id): Path<Uuid>,
) -> Result<Json<RecipeResponse>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let model = entities::Entity::find_by_id(id)
        .one(&db)
        .await?
        .ok_or_else(|| sea_orm::DbErr::Custom("Not found".to_string()))?;
    if model.user_id != user_id {
        return Err(sea_orm::DbErr::Custom("Unauthorized".to_string()).into());
    }
    let ingredients: Vec<Ingredient> = serde_json::from_value(model.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let steps: Vec<String> = serde_json::from_value(model.steps)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let tags: Option<Vec<String>> = model.tags.map(|t| serde_json::from_value::<Vec<String>>(t)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))).transpose()?;
    Ok(Json(RecipeResponse {
        id: model.id,
        user_id: model.user_id,
        title: model.title,
        ingredients,
        steps,
        description: model.description,
        image_url: model.image_url,
        tags,
        prep_time: model.prep_time,
        cook_time: model.cook_time,
        created_at: model.created_at,
    }))
}

pub async fn create_recipe(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    Json(payload): Json<CreateRecipe>,
) -> Result<Json<RecipeResponse>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let ingredients_value = serde_json::to_value(&payload.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let steps_value = serde_json::to_value(&payload.steps)
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let tags_value = payload.tags.as_ref().map(|t| serde_json::to_value(t))
        .transpose()
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let recipe = entities::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        title: Set(payload.title),
        ingredients: Set(ingredients_value),
        steps: Set(steps_value),
        description: Set(payload.description),
        image_url: Set(payload.image_url),
        tags: Set(tags_value),
        prep_time: Set(payload.prep_time),
        cook_time: Set(payload.cook_time),
        ..Default::default()
    };
    let inserted = recipe.insert(&db).await?;
    let ingredients: Vec<Ingredient> = serde_json::from_value(inserted.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let steps: Vec<String> = serde_json::from_value(inserted.steps)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let tags: Option<Vec<String>> = inserted.tags.map(|t| serde_json::from_value::<Vec<String>>(t)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))).transpose()?;
    Ok(Json(RecipeResponse {
        id: inserted.id,
        user_id: inserted.user_id,
        title: inserted.title,
        ingredients,
        steps,
        description: inserted.description,
        image_url: inserted.image_url,
        tags,
        prep_time: inserted.prep_time,
        cook_time: inserted.cook_time,
        created_at: inserted.created_at,
    }))
}

pub async fn update_recipe(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CreateRecipe>,
) -> Result<Json<RecipeResponse>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let recipe_model = entities::Entity::find_by_id(id).one(&db).await?.ok_or(sea_orm::DbErr::Custom("Not found".to_string()))?;
    if recipe_model.user_id != user_id {
        return Err(sea_orm::DbErr::Custom("Unauthorized".to_string()).into());
    }
    let mut recipe: entities::ActiveModel = recipe_model.into();
    let ingredients_value = serde_json::to_value(&payload.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let steps_value = serde_json::to_value(&payload.steps)
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let tags_value = payload.tags.as_ref().map(|t| serde_json::to_value(t))
        .transpose()
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    recipe.title = Set(payload.title);
    recipe.ingredients = Set(ingredients_value);
    recipe.steps = Set(steps_value);
    recipe.description = Set(payload.description);
    recipe.image_url = Set(payload.image_url);
    recipe.tags = Set(tags_value);
    recipe.prep_time = Set(payload.prep_time);
    recipe.cook_time = Set(payload.cook_time);
    let updated = recipe.update(&db).await?;
    let ingredients: Vec<Ingredient> = serde_json::from_value(updated.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let steps: Vec<String> = serde_json::from_value(updated.steps)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    let tags: Option<Vec<String>> = updated.tags.map(|t| serde_json::from_value::<Vec<String>>(t)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))).transpose()?;
    Ok(Json(RecipeResponse {
        id: updated.id,
        user_id: updated.user_id,
        title: updated.title,
        ingredients,
        steps,
        description: updated.description,
        image_url: updated.image_url,
        tags,
        prep_time: updated.prep_time,
        cook_time: updated.cook_time,
        created_at: updated.created_at,
    }))
}

pub async fn search_recipes(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<RecipeResponse>>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let query = entities::Entity::find()
        .filter(entities::Column::UserId.eq(user_id));

    let _tags: Option<Vec<String>> = params.get("tags").map(|s: &String| {
        s.split(',')
            .map(|t: &str| t.trim().to_lowercase())
            .filter(|t: &String| !t.is_empty() && t.len() <= 50)
            .collect()
    }).filter(|v: &Vec<String>| !v.is_empty());

    let search_ingredients: Option<Vec<String>> = params.get("ingredients").map(|s: &String| {
        s.split(',')
            .map(|i: &str| i.trim().to_lowercase())
            .filter(|i: &String| !i.is_empty() && i.len() <= 50)
            .collect()
    }).filter(|v: &Vec<String>| !v.is_empty());

    let recipes = query.all(&db).await?;
    let mut responses: Vec<RecipeResponse> = Vec::new();

    for model in recipes {
        let ingredients: Vec<Ingredient> = serde_json::from_value(model.ingredients.clone())
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
        let steps: Vec<String> = serde_json::from_value(model.steps.clone())
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
        let tags: Option<Vec<String>> = model.tags.clone().map(|t| serde_json::from_value::<Vec<String>>(t)
            .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))).transpose()?;

        let mut matches = true;

        if let Some(search_tags) = &tags {
            if let Some(recipe_tags) = &tags {
                let recipe_tags_lower: Vec<String> = recipe_tags.iter().map(|t| t.to_lowercase()).collect();
                matches &= search_tags.iter().any(|st| recipe_tags_lower.contains(st));
            } else {
                matches = false;
            }
        }

        if let Some(search_ingredients) = &search_ingredients {
            let recipe_ingredients_lower: Vec<String> = ingredients.iter().map(|i: &Ingredient| i.name.to_lowercase()).collect();
            matches &= search_ingredients.iter().any(|si: &String| recipe_ingredients_lower.iter().any(|ri: &String| ri.contains(si)));
        }

        if matches {
            responses.push(RecipeResponse {
                id: model.id,
                user_id: model.user_id,
                title: model.title,
                ingredients,
                steps,
                description: model.description,
                image_url: model.image_url,
                tags,
                prep_time: model.prep_time,
                cook_time: model.cook_time,
                created_at: model.created_at,
            });
        }
    }

    Ok(Json(responses))
}

pub async fn delete_recipe(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let recipe = entities::Entity::find_by_id(id).one(&db).await?.ok_or(sea_orm::DbErr::Custom("Not found".to_string()))?;
    if recipe.user_id != user_id {
        return Err(sea_orm::DbErr::Custom("Unauthorized".to_string()).into());
    }
    entities::Entity::delete_by_id(id).exec(&db).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub async fn register(
    State(db): State<sea_orm::DatabaseConnection>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, crate::AppError> {
    // Check if user exists
    let existing = entities::user::Entity::find()
        .filter(entities::user::Column::Email.eq(&req.email))
        .one(&db)
        .await?;
    if existing.is_some() {
        return Err(crate::AppError::SeaOrm(sea_orm::DbErr::Custom("User already exists".to_string())));
    }

    // Hash password
    let password_hash = hash(req.password, DEFAULT_COST)?;

    // Create user
    let user = entities::user::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(req.email),
        password_hash: Set(password_hash),
        created_at: Set(chrono::Utc::now()),
    };
    let user = user.insert(&db).await?;

    // Generate token
    let token = generate_jwt(&user.id.to_string())?;

    Ok(Json(AuthResponse { token }))
}

pub async fn login(
    State(db): State<sea_orm::DatabaseConnection>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, crate::AppError> {
    // Find user
    let user = entities::user::Entity::find()
        .filter(entities::user::Column::Email.eq(&req.email))
        .one(&db)
        .await?
        .ok_or_else(|| sea_orm::DbErr::Custom("Invalid credentials".to_string()))?;

    // Verify password
    if !verify(&req.password, &user.password_hash)? {
        return Err(crate::AppError::SeaOrm(sea_orm::DbErr::Custom("Invalid credentials".to_string())));
    }

    // Generate token
    let token = generate_jwt(&user.id.to_string())?;

    Ok(Json(AuthResponse { token }))
}

#[derive(Deserialize)]
pub struct ScrapeRequest {
    pub url: String,
}

#[derive(Serialize)]
pub struct ScrapedRecipeResponse {
    pub title: String,
    pub description: String,
    pub ingredients: Vec<IngredientData>,
    pub steps: Vec<String>,
    pub image_urls: Vec<String>,
    pub prep_time: Option<i32>,
    pub cook_time: Option<i32>,
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize)]
pub struct IngredientData {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
}

pub async fn scrape_recipe(
    _claims: Claims,
    Json(req): Json<ScrapeRequest>,
) -> Result<Json<ScrapedRecipeResponse>, crate::AppError> {
    let draft = crate::scrape::scrape_url(&req.url).await?;
    Ok(Json(draft_to_response(draft)))
}

#[derive(Deserialize)]
pub struct PhotoImportRequest {
    pub image_base64: String,
    #[serde(default)]
    pub mime_type: Option<String>,
}

pub async fn import_recipe_photo(
    _claims: Claims,
    Json(req): Json<PhotoImportRequest>,
) -> Result<Json<ScrapedRecipeResponse>, crate::AppError> {
    let mime = req.mime_type.as_deref().unwrap_or("image/jpeg");
    if !mime.starts_with("image/") || mime.contains(';') || mime.contains('\n') {
        return Err(crate::AppError::BadRequest("Unsupported image type".into()));
    }
    if req.image_base64.trim().is_empty() {
        return Err(crate::AppError::BadRequest("Image is required".into()));
    }
    if req.image_base64.len() > 8_000_000 {
        return Err(crate::AppError::BadRequest("Image is too large".into()));
    }
    let draft = crate::scrape::scrape_image(&req.image_base64, mime).await?;
    Ok(Json(draft_to_response(draft)))
}

fn draft_to_response(draft: crate::scrape::DraftRecipe) -> ScrapedRecipeResponse {
    ScrapedRecipeResponse {
        title: draft.title,
        description: draft.description,
        ingredients: draft
            .ingredients
            .into_iter()
            .map(|ingredient| IngredientData {
                name: ingredient.name,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
            })
            .collect(),
        steps: draft.steps,
        image_urls: draft.image_urls,
        prep_time: draft.prep_time,
        cook_time: draft.cook_time,
        tags: draft.tags,
    }
}
