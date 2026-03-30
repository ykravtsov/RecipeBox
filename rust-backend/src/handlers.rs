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
    let client = Client::new();
    let html = fetch_html(&client, &req.url).await?;
    let image_urls = extract_image_urls(&html, &req.url);

    // First try JSON-LD structured data (faster + more reliable)
    if let Some(parsed) = extract_jsonld_recipe(&html) {
        return Ok(Json(ScrapedRecipeResponse {
            title: parsed.title,
            description: parsed.description,
            ingredients: parsed.ingredients.into_iter().map(|i| IngredientData {
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
            }).collect(),
            steps: parsed.steps,
            image_urls,
            prep_time: parsed.prep_time,
            cook_time: parsed.cook_time,
            tags: parsed.tags,
        }));
    }

    // Fallback to LLM
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
        prep_time: parsed.prep_time,
        cook_time: parsed.cook_time,
        tags: parsed.tags,
    }))
}

fn decode_html_entities(s: &str) -> String {
    let mut result = s.to_string();
    result = result.replace("&#039;", "'");
    result = result.replace("&#8217;", "\u{2019}");
    result = result.replace("&#8216;", "\u{2018}");
    result = result.replace("&#8220;", "\u{201C}");
    result = result.replace("&#8221;", "\u{201D}");
    result = result.replace("&#8211;", "\u{2013}");
    result = result.replace("&#8212;", "\u{2014}");
    result = result.replace("&nbsp;", " ");
    result = result.replace("<", "<");
    result = result.replace(">", ">");
    result = result.replace("&", "&");
    result
}

fn extract_jsonld_recipe(html: &str) -> Option<ParsedRecipe> {
    let re = Regex::new(r#"(?is)<script[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>"#).ok()?;
    for cap in re.captures_iter(html) {
        let json_text = cap.get(1)?.as_str().trim();
        let value: serde_json::Value = serde_json::from_str(json_text).ok()?;

        // Handle @graph arrays
        let candidates: Vec<&serde_json::Value> = if let Some(graph) = value.get("@graph").and_then(|g| g.as_array()) {
            graph.iter().collect()
        } else {
            vec![&value]
        };

        for candidate in candidates {
            let rtype = candidate.get("@type").and_then(|t| t.as_str()).unwrap_or("");
            if !rtype.contains("Recipe") {
                if let Some(arr) = candidate.get("@type").and_then(|t| t.as_array()) {
                    if !arr.iter().any(|v| v.as_str().map(|s| s.contains("Recipe")).unwrap_or(false)) {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            let title = decode_html_entities(candidate.get("name").and_then(|v| v.as_str()).unwrap_or("Untitled"));
            let description = decode_html_entities(candidate.get("description").and_then(|v| v.as_str()).unwrap_or(""));

            // Parse ingredients
            let ingredients = candidate.get("recipeIngredient")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| {
                    parse_ingredient_string(&decode_html_entities(s))
                }).collect::<Vec<_>>())
                .unwrap_or_default();

            // Parse steps
            let steps = candidate.get("recipeInstructions")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|instruction| {
                    if let Some(text) = instruction.as_str() {
                        Some(decode_html_entities(text))
                    } else if let Some(text) = instruction.get("text").and_then(|t| t.as_str()) {
                        Some(decode_html_entities(text))
                    } else {
                        None
                    }
                }).collect::<Vec<_>>())
                .unwrap_or_default();

            // Parse prep/cook time (ISO 8601 duration: PTxHxM)
            let prep_time = candidate.get("prepTime")
                .and_then(|v| v.as_str())
                .and_then(|s| parse_iso_duration_to_minutes(s));
            let cook_time = candidate.get("cookTime")
                .and_then(|v| v.as_str())
                .and_then(|s| parse_iso_duration_to_minutes(s));

            // Parse tags from keywords / recipeCategory
            let mut tags: Vec<String> = Vec::new();
            if let Some(kw) = candidate.get("keywords").and_then(|v| v.as_str()) {
                tags.extend(kw.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
            }
            if let Some(cats) = candidate.get("recipeCategory") {
                match cats {
                    serde_json::Value::String(s) => tags.push(s.clone()),
                    serde_json::Value::Array(arr) => {
                        tags.extend(arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()));
                    }
                    _ => {}
                }
            }
            let tags = if tags.is_empty() { None } else { Some(tags) };

            if !title.is_empty() && (!ingredients.is_empty() || !steps.is_empty()) {
                return Some(ParsedRecipe { title, description, ingredients, steps, prep_time, cook_time, tags });
            }
        }
    }
    None
}

fn parse_iso_duration_to_minutes(s: &str) -> Option<i32> {
    let s = s.to_uppercase();
    let mut total_minutes: i32 = 0;
    let re = Regex::new(r"(\d+)([WDHMS])").ok()?;
    for cap in re.captures_iter(&s) {
        let value: i32 = cap.get(1)?.as_str().parse().ok()?;
        match cap.get(2)?.as_str() {
            "W" => total_minutes += value * 7 * 24 * 60,
            "D" => total_minutes += value * 24 * 60,
            "H" => total_minutes += value * 60,
            "M" => total_minutes += value,
            _ => {}
        }
    }
    if total_minutes > 0 { Some(total_minutes) } else { None }
}

fn parse_ingredient_string(s: &str) -> ParsedIngredient {
    // Simple heuristic: "1.5 cups flour" -> quantity=1.5, unit="cups", name="flour"
    let parts: Vec<&str> = s.splitn(3, ' ').collect();
    let (quantity, unit, name) = match parts.as_slice() {
        [q, u, n] => {
            let qty = q.replace('/', " ").split_whitespace().next()
                .and_then(|v| parse_fraction(v)).unwrap_or(1.0);
            (qty, u.to_string(), n.to_string())
        }
        [q, rest] => {
            let qty = parse_fraction(q).unwrap_or(1.0);
            (qty, "piece".to_string(), rest.to_string())
        }
        _ => (1.0, "piece".to_string(), s.to_string()),
    };
    ParsedIngredient { name, quantity, unit }
}

fn parse_fraction(s: &str) -> Option<f64> {
    if let Ok(v) = s.parse::<f64>() {
        return Some(v);
    }
    if let Some((n, d)) = s.split_once('/') {
        let num: f64 = n.trim().parse().ok()?;
        let den: f64 = d.trim().parse().ok()?;
        if den != 0.0 { return Some(num / den); }
    }
    None
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
    #[serde(default)]
    prep_time: Option<i32>,
    #[serde(default)]
    cook_time: Option<i32>,
    #[serde(default)]
    tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct ParsedIngredient {
    name: String,
    quantity: f64,
    unit: String,
}

async fn parse_recipe_with_llm(html: &str) -> Result<ParsedRecipe, crate::AppError> {
    // Truncate to ~80k chars to stay within model context limits
    let html = if html.len() > 80_000 { &html[..80_000] } else { html };

    let prompt = format!(r###"
You are a recipe extraction expert. Extract the recipe information from the following HTML content and return it as JSON.

HTML Content:
{}

Please extract the following information from the recipe HTML and return it as a JSON object with this exact structure:
{{
    "title": "Recipe title",
    "description": "Brief description of the recipe",
    "prep_time": 20,
    "cook_time": 45,
    "tags": ["dinner", "comfort food"],
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
- prep_time and cook_time are integers in minutes, or null if not found
- tags are an array of strings extracted from keywords, categories, or cuisine type
- For ingredients, try to parse quantity and unit. If you can't determine quantity/unit, use quantity: 1 and unit: "piece"
- If any field cannot be found, use appropriate defaults or empty arrays/nulls
- Make sure the JSON is valid and properly formatted

Return only the JSON object, no additional text or explanation.
"###, html);

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
        model: "grok-4.20-0309-reasoning".to_string(),
        stream: false,
        temperature: 0.0,
        response_format: LlmResponseFormat { r#type: "text".to_string() },
    };

    let xai_api_key = std::env::var("XAI_API_KEY").expect("XAI_API_KEY must be set");
    let client = Client::new();
    let response = client
        .post("https://api.x.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", xai_api_key))
        .json(&request_body)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!("xAI API error {}: {}", status, body);
        return Err(crate::AppError::from(sea_orm::DbErr::Custom(format!("LLM API error {}: {}", status, body))));
    }

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