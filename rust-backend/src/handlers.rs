use axum::{extract::{Path, State}, http::StatusCode, Json};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use regex::Regex;
use url::Url;

use crate::auth::{generate_jwt, Claims};
use crate::entities::{self, Ingredient};

#[derive(serde::Deserialize)]
pub struct CreateRecipe {
    pub title: String,
    pub ingredients: Vec<Ingredient>,
    pub instructions: String,
}

#[derive(serde::Serialize)]
pub struct RecipeResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub ingredients: Vec<Ingredient>,
    pub instructions: String,
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
        Ok(RecipeResponse {
            id: model.id,
            user_id: model.user_id,
            title: model.title,
            ingredients,
            instructions: model.instructions,
            created_at: model.created_at,
        })
    }).collect::<Result<Vec<_>, _>>()?;
    Ok(Json(responses))
}

pub async fn create_recipe(
    claims: Claims,
    State(db): State<sea_orm::DatabaseConnection>,
    Json(payload): Json<CreateRecipe>,
) -> Result<Json<RecipeResponse>, crate::AppError> {
    let user_id = Uuid::parse_str(&claims.sub)?;
    let ingredients_value = serde_json::to_value(&payload.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Serialization error".to_string()))?;
    let recipe = entities::ActiveModel {
        user_id: Set(user_id),
        title: Set(payload.title),
        ingredients: Set(ingredients_value),
        instructions: Set(payload.instructions),
        ..Default::default()
    };
    let inserted = recipe.insert(&db).await?;
    let ingredients: Vec<Ingredient> = serde_json::from_value(inserted.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    Ok(Json(RecipeResponse {
        id: inserted.id,
        user_id: inserted.user_id,
        title: inserted.title,
        ingredients,
        instructions: inserted.instructions,
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
    recipe.title = Set(payload.title);
    recipe.ingredients = Set(ingredients_value);
    recipe.instructions = Set(payload.instructions);
    let updated = recipe.update(&db).await?;
    let ingredients: Vec<Ingredient> = serde_json::from_value(updated.ingredients)
        .map_err(|_| sea_orm::DbErr::Custom("Deserialization error".to_string()))?;
    Ok(Json(RecipeResponse {
        id: updated.id,
        user_id: updated.user_id,
        title: updated.title,
        ingredients,
        instructions: updated.instructions,
        created_at: updated.created_at,
    }))
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
    let client = Client::new();
    let html = fetch_html(&client, &req.url).await?;
    let image_urls = extract_image_urls(&html, &req.url);
    let parsed = parse_recipe_with_llm(&html).await?;

    Ok(Json(ScrapedRecipeResponse {
        title: parsed.title,
        description: parsed.description,
        ingredients: parsed.ingredients.into_iter().map(|i| IngredientData {
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
        }).collect(),
        steps: parsed.steps,
        image_urls,
    }))
}

async fn fetch_html(client: &Client, url: &str) -> Result<String, crate::AppError> {
    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (compatible; RecipeScraper/1.0)")
        .send()
        .await?;
    let html = response.text().await?;
    Ok(html)
}

fn extract_image_urls(html: &str, base_url: &str) -> Vec<String> {
    let re = Regex::new(r#"<img[^>]*(?:src|data-src|data-lazy-src|data-original|data-url)\s*=\s*["']([^"']*)["']"#).unwrap();
    let image_extensions: std::collections::HashSet<&str> = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].into();
    let mut urls = Vec::new();

    for cap in re.captures_iter(html) {
        if let Some(src) = cap.get(1) {
            let src = src.as_str();
            if !src.contains("avatar") && !src.contains("logo") && !src.contains("icon") &&
               !src.contains("banner") && !src.contains("header") && !src.contains("footer") &&
               src.len() > 10 && image_extensions.iter().any(|ext| src.to_lowercase().ends_with(ext)) {
                if let Some(abs_url) = resolve_url(src, base_url) {
                    urls.push(abs_url);
                }
            }
        }
    }

    urls.into_iter().collect::<std::collections::HashSet<_>>().into_iter().collect()
}

fn resolve_url(url: &str, base_url: &str) -> Option<String> {
    if Url::parse(url).is_ok() {
        Some(url.to_string())
    } else if let Ok(base) = Url::parse(base_url) {
        base.join(url).ok().map(|u| u.to_string())
    } else {
        None
    }
}

#[derive(Serialize)]
struct LlmRequest {
    messages: Vec<LlmMessage>,
    model: String,
    stream: bool,
    temperature: f64,
    response_format: LlmResponseFormat,
}

#[derive(Serialize)]
struct LlmMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct LlmResponseFormat {
    r#type: String,
}

#[derive(Deserialize)]
struct LlmResponse {
    choices: Vec<LlmChoice>,
}

#[derive(Deserialize)]
struct LlmChoice {
    message: LlmMessageResponse,
}

#[derive(Deserialize)]
struct LlmMessageResponse {
    content: String,
}

#[derive(Deserialize)]
struct ParsedRecipe {
    title: String,
    description: String,
    ingredients: Vec<ParsedIngredient>,
    steps: Vec<String>,
}

#[derive(Deserialize)]
struct ParsedIngredient {
    name: String,
    quantity: f64,
    unit: String,
}

async fn parse_recipe_with_llm(html: &str) -> Result<ParsedRecipe, crate::AppError> {
    let prompt = format!(r#"
You are a recipe extraction expert. Extract the recipe information from the following HTML content and return it as JSON.

HTML Content:
{}

Please extract the following information from the recipe HTML and return it as a JSON object with this exact structure:
{{
    "title": "Recipe title",
    "description": "Brief description of the recipe",
    "ingredients": [
        {{
            "name": "ingredient name",
            "quantity": 1.5,
            "unit": "cups"
        }}
    ],
    "steps": ["Step 1", "Step 2", "Step 3"]
}}

Rules:
- For ingredients, try to parse quantity and unit. If you can't determine quantity/unit, use quantity: 1 and unit: "piece"
- If any field cannot be found, use appropriate defaults or empty arrays
- Make sure the JSON is valid and properly formatted

Return only the JSON object, no additional text or explanation.
"#, html);

    let request_body = LlmRequest {
        messages: vec![
            LlmMessage {
                role: "system".to_string(),
                content: "You are a recipe parser. Output strictly valid JSON. No markdown. No conversational text.".to_string(),
            },
            LlmMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        model: "grok-4-1-fast-reasoning".to_string(),
        stream: false,
        temperature: 0.1,
        response_format: LlmResponseFormat { r#type: "json_object".to_string() },
    };

    let xai_api_key = std::env::var("XAI_API_KEY").expect("XAI_API_KEY must be set");
    let client = Client::new();
    let response = client
        .post("https://api.x.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", xai_api_key))
        .json(&request_body)
        .send()
        .await?;

    let llm_response: LlmResponse = response.json().await?;
    let json_text = llm_response.choices[0].message.content.clone();

    // Clean JSON
    let json_text = json_text.trim();
    let json_text = if json_text.starts_with("```json") { json_text.strip_prefix("```json").unwrap_or(&json_text) } else { &json_text };
    let json_text = if json_text.ends_with("```") { json_text.strip_suffix("```").unwrap_or(json_text) } else { json_text };
    let start = json_text.find('{').unwrap_or(0);
    let end = json_text.rfind('}').unwrap_or(json_text.len());
    let json_text = &json_text[start..=end];

    let parsed: ParsedRecipe = serde_json::from_str(json_text)?;
    Ok(parsed)
}