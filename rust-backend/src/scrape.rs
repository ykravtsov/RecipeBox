//! Recipe import: page scrape, Pinterest pins, and cookbook-photo vision.

use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

#[derive(Debug, thiserror::Error)]
pub enum ScrapeError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, PartialEq)]
pub struct DraftIngredient {
    pub name: String,
    pub quantity: f64,
    pub unit: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DraftRecipe {
    pub title: String,
    pub description: String,
    pub ingredients: Vec<DraftIngredient>,
    pub steps: Vec<String>,
    pub image_urls: Vec<String>,
    pub prep_time: Option<i32>,
    pub cook_time: Option<i32>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PinterestPin {
    pub title: String,
    pub text: String,
    pub images: Vec<String>,
    /// Recipe website the pin points at, when it has one.
    pub external_source: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum FetchPlan {
    /// Ordinary recipe page. Parse this HTML.
    RecipePage,
    /// Pinterest pin that links out to a source website.
    ExternalSource(String),
    /// Pinterest pin whose recipe lives in the pin itself.
    PinContent,
}

pub async fn scrape_url(url: &str) -> Result<DraftRecipe, ScrapeError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    let html = fetch_html(&client, url).await?;
    match plan_fetch(url, &html) {
        FetchPlan::ExternalSource(source) => match fetch_html(&client, &source).await {
            Ok(source_html) => draft_from_page(&source_html, &source).await,
            Err(_) => draft_from_pin(&html, url).await,
        },
        FetchPlan::PinContent => draft_from_pin(&html, url).await,
        FetchPlan::RecipePage => draft_from_page(&html, url).await,
    }
}

pub async fn scrape_image(image_base64: &str, mime_type: &str) -> Result<DraftRecipe, ScrapeError> {
    if !mime_type.starts_with("image/") {
        return Err(ScrapeError::Message("Unsupported image type".into()));
    }
    let b64 = normalize_base64(image_base64);
    if b64.is_empty() {
        return Err(ScrapeError::Message("Image is required".into()));
    }
    let prompt = format!(
        "You are reading a photograph of a printed cookbook page. Use OCR and transcribe the recipe on the page.\n\
         Extract the title, ingredients, and steps exactly as printed. Ignore page numbers, headers, and ads.\n\
         If the photo shows more than one recipe, extract the main one.\n\n{}",
        JSON_SCHEMA
    );
    let data_url = format!("data:{};base64,{}", mime_type, b64);
    let content = serde_json::json!([
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": data_url}}
    ]);
    let model = std::env::var("XAI_VISION_MODEL").unwrap_or_else(|_| "grok-2-vision-1212".to_string());
    let parsed = call_llm(&model, content).await?;
    Ok(to_draft(parsed, Vec::new()))
}

pub fn plan_fetch(url: &str, html: &str) -> FetchPlan {
    if !is_pinterest_pin_url(url) {
        return FetchPlan::RecipePage;
    }
    match extract_pinterest_pin(html, url).external_source {
        Some(source) => FetchPlan::ExternalSource(source),
        None => FetchPlan::PinContent,
    }
}

fn normalize_base64(input: &str) -> String {
    let trimmed = input.trim();
    let raw = if let Some(idx) = trimmed.find("base64,") {
        &trimmed[idx + "base64,".len()..]
    } else {
        trimmed
    };
    raw.chars().filter(|c| !c.is_whitespace()).collect()
}

async fn draft_from_page(html: &str, url: &str) -> Result<DraftRecipe, ScrapeError> {
    let images = extract_main_recipe_images(html, url);
    let parsed = if let Some(parsed) = extract_jsonld_recipe(html) {
        parsed
    } else {
        parse_recipe_with_llm(html).await?
    };
    Ok(to_draft(parsed, images))
}

async fn draft_from_pin(html: &str, url: &str) -> Result<DraftRecipe, ScrapeError> {
    let pin = extract_pinterest_pin(html, url);
    if pin.text.trim().chars().count() < 15 && pin.title.trim().is_empty() {
        return Err(ScrapeError::Message(
            "This Pinterest pin has no external recipe website and no recipe text to import.".into(),
        ));
    }
    let parsed = if let Some(parsed) = extract_jsonld_recipe(html) {
        parsed
    } else {
        let source = format!(
            "This recipe was published on a Pinterest pin with no external source website. \
             Extract the recipe from the pin title, description, and text only.\n\n\
             Title: {}\n\nPin text:\n{}\n\n{}",
            pin.title, pin.text, JSON_SCHEMA
        );
        parse_recipe_with_llm(&source).await?
    };
    let images = if pin.images.is_empty() {
        extract_main_recipe_images(html, url)
    } else {
        pin.images
    };
    Ok(to_draft(parsed, images))
}

fn to_draft(parsed: ParsedRecipe, image_urls: Vec<String>) -> DraftRecipe {
    DraftRecipe {
        title: parsed.title,
        description: parsed.description,
        ingredients: parsed
            .ingredients
            .into_iter()
            .map(|i| DraftIngredient {
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
            })
            .collect(),
        steps: parsed.steps,
        image_urls,
        prep_time: parsed.prep_time,
        cook_time: parsed.cook_time,
        tags: parsed.tags,
    }
}

const JSON_SCHEMA: &str = r#"Return a JSON object with this exact structure:
{
    "title": "Recipe title",
    "description": "Brief description of the recipe",
    "prep_time": 20,
    "cook_time": 45,
    "tags": ["dinner"],
    "ingredients": [
        {"name": "ingredient name", "quantity": 1.5, "unit": "cups"}
    ],
    "steps": ["Step 1", "Step 2"]
}

Rules:
- prep_time and cook_time are integers in minutes, or null if not found
- For ingredients, parse quantity and unit. If you cannot determine them, use quantity 1 and unit "piece"
- If a field cannot be found, use an empty string, an empty array, or null
- Return only the JSON object"#;

async fn fetch_html(client: &Client, url: &str) -> Result<String, ScrapeError> {
    let response = client
        .get(url)
        .header("User-Agent", user_agent_for(url))
        .header("Accept", "text/html,application/xhtml+xml")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await?;
    if !response.status().is_success() {
        return Err(ScrapeError::Message(format!(
            "Fetching {} returned {}",
            url,
            response.status()
        )));
    }
    Ok(response.text().await?)
}

fn user_agent_for(url: &str) -> &'static str {
    if is_pinterest_pin_url(url) {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    } else {
        "Mozilla/5.0 (compatible; RecipeScraper/1.0)"
    }
}

pub fn is_pinterest_pin_url(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return false;
    };
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    if host == "pin.it" || host.ends_with(".pin.it") {
        return !parsed.path().trim_matches('/').is_empty();
    }
    is_pinterest_host(&host) && parsed.path().to_ascii_lowercase().contains("/pin/")
}

fn is_pinterest_host(host: &str) -> bool {
    let host = host
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    host == "pin.it"
        || host.ends_with(".pin.it")
        || host == "pinterest.com"
        || host.starts_with("pinterest.")
        || host.ends_with(".pinterest.com")
        || host.split('.').any(|label| label == "pinterest")
}

fn extract_pinterest_pin(html: &str, page_url: &str) -> PinterestPin {
    let mut title = meta_contents(html, &["og:title", "twitter:title"])
        .into_iter()
        .next()
        .unwrap_or_default();
    if title.is_empty() {
        title = html_title(html).unwrap_or_default();
    }
    title = strip_pinterest_suffix(&decode_html_entities(&title));

    let mut texts: Vec<String> = Vec::new();
    for value in meta_contents(
        html,
        &["og:description", "twitter:description", "description"],
    ) {
        push_pin_text(&mut texts, &value);
    }
    for key in [
        "closeup_unified_description",
        "closeup_description",
        "grid_description",
        "description",
    ] {
        for value in json_string_values(html, key) {
            push_pin_text(&mut texts, &value);
        }
    }
    if title.is_empty() {
        if let Some(grid) = json_string_values(html, "grid_title").into_iter().next() {
            title = strip_pinterest_suffix(&grid);
        }
    }

    let mut images = Vec::new();
    for url in meta_contents(html, &["og:image", "og:image:url", "og:image:secure_url", "twitter:image"]) {
        if is_related_pin_thumbnail(&url) {
            continue;
        }
        push_unique_url(&mut images, resolve_url(&url, page_url));
    }
    for raw in json_image_urls(html) {
        if is_related_pin_thumbnail(&raw) {
            continue;
        }
        push_unique_url(&mut images, resolve_url(&raw, page_url));
    }

    PinterestPin {
        title,
        text: texts.join("\n\n"),
        images,
        external_source: external_pin_source(html),
    }
}

fn push_pin_text(parts: &mut Vec<String>, raw: &str) {
    let text = decode_html_entities(raw).trim().to_string();
    if text.chars().count() < 12 || is_generic_pinterest_blurb(&text) {
        return;
    }
    if let Some(existing) = parts.iter_mut().find(|p| p.contains(&text) || text.contains(p.as_str())) {
        if text.len() > existing.len() {
            *existing = text;
        }
        return;
    }
    parts.push(text);
}

fn is_generic_pinterest_blurb(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.contains("discover recipes, home ideas")
        || lower.contains("find and save ideas")
        || lower.contains("log in to see more")
        || lower == "pinterest"
}

fn strip_pinterest_suffix(title: &str) -> String {
    let mut title = title.trim().to_string();
    for suffix in [" | Pinterest", " - Pinterest", " | pinterest"] {
        if let Some(stripped) = title.strip_suffix(suffix) {
            title = stripped.trim().to_string();
        }
    }
    title
}

fn external_pin_source(html: &str) -> Option<String> {
    for key in ["link", "tracked_link"] {
        for candidate in json_string_values(html, key) {
            if is_external_recipe_url(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

fn is_external_recipe_url(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return false;
    };
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return false;
    }
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    if is_pinterest_host(&host) || host.contains("pinimg.com") || is_social_host(&host) {
        return false;
    }
    let path = parsed.path().to_ascii_lowercase();
    const ASSET: &[&str] = &[".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"];
    if ASSET.iter().any(|ext| path.ends_with(ext)) {
        return false;
    }
    true
}

fn is_social_host(host: &str) -> bool {
    const SOCIAL: &[&str] = &[
        "instagram.com",
        "facebook.com",
        "fb.com",
        "tiktok.com",
        "twitter.com",
        "x.com",
        "youtube.com",
        "youtu.be",
    ];
    let host = host.trim_start_matches("www.");
    SOCIAL
        .iter()
        .any(|name| host == *name || host.ends_with(&format!(".{}", name)))
}

fn is_related_pin_thumbnail(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.contains("/236x/")
        || lower.contains("/75x75")
        || lower.contains("/170x/")
        || lower.contains("/60x60")
}

/// Original pin image URLs embedded as `"orig": {"url": "..."}` or `"736x": {"url": "..."}`.
fn json_image_urls(html: &str) -> Vec<String> {
    let re = Regex::new(
        r#""(?:orig|736x|originals)"\s*:\s*\{[^{}]{0,400}?"url"\s*:\s*"((?:\\.|[^"\\])*)""#,
    )
    .unwrap();
    let mut urls = Vec::new();
    for cap in re.captures_iter(html) {
        if let Some(raw) = cap.get(1) {
            if let Some(url) = unescape_json_string(raw.as_str()) {
                urls.push(url);
            }
        }
    }
    urls
}

fn json_string_values(html: &str, key: &str) -> Vec<String> {
    let pattern = format!(
        r#""{}"\s*:\s*"((?:\\.|[^"\\])*)""#,
        regex::escape(key)
    );
    let Ok(re) = Regex::new(&pattern) else {
        return Vec::new();
    };
    let mut values = Vec::new();
    for cap in re.captures_iter(html) {
        if let Some(raw) = cap.get(1) {
            if let Some(value) = unescape_json_string(raw.as_str()) {
                if !value.trim().is_empty() {
                    values.push(value);
                }
            }
        }
    }
    values
}

fn unescape_json_string(raw: &str) -> Option<String> {
    let wrapped = format!("\"{}\"", raw);
    serde_json::from_str::<String>(&wrapped).ok()
}

fn html_title(html: &str) -> Option<String> {
    let re = Regex::new(r"(?is)<title[^>]*>(.*?)</title>").ok()?;
    let text = re.captures(html)?.get(1)?.as_str();
    let text = decode_html_entities(text);
    let text = text.trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

pub fn extract_main_recipe_images(html: &str, base_url: &str) -> Vec<String> {
    let mut urls = Vec::new();
    for raw in extract_jsonld_recipe_images(html) {
        if is_junk_image_url(&raw) {
            continue;
        }
        push_unique_url(&mut urls, resolve_url(&raw, base_url));
    }
    for raw in meta_contents(
        html,
        &["og:image", "og:image:url", "og:image:secure_url", "twitter:image"],
    ) {
        if is_junk_image_url(&raw) {
            continue;
        }
        push_unique_url(&mut urls, resolve_url(&raw, base_url));
    }
    if urls.is_empty() {
        if let Some(hero) = extract_article_hero_image(html, base_url) {
            urls.push(hero);
        }
    }
    urls
}

fn push_unique_url(urls: &mut Vec<String>, url: Option<String>) {
    if let Some(url) = url {
        if !is_junk_image_url(&url) && !urls.iter().any(|existing| existing == &url) {
            urls.push(url);
        }
    }
}

fn is_junk_image_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.contains("/ads/")
        || lower.contains("doubleclick")
        || lower.contains("adservice")
        || lower.contains("adsbygoogle")
        || lower.contains("pixel")
        || lower.contains("spacer")
        || lower.contains("tracking")
        || lower.contains("favicon")
        || lower.contains("sprite")
        || lower.contains("gravatar")
        || lower.contains("1x1")
        || lower.contains("/logo")
        || lower.contains("logo.")
        || lower.contains("avatar")
}

fn extract_jsonld_recipe_images(html: &str) -> Vec<String> {
    let mut urls = Vec::new();
    for node in iter_jsonld(html) {
        for candidate in jsonld_nodes(&node) {
            if !is_recipe_type(candidate) {
                continue;
            }
            if let Some(image) = candidate.get("image") {
                collect_image_values(image, &mut urls);
            }
        }
    }
    urls
}

fn collect_image_values(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::String(s) => out.push(s.clone()),
        Value::Array(items) => {
            for item in items {
                collect_image_values(item, out);
            }
        }
        Value::Object(_) => {
            if let Some(url) = value.get("url").and_then(|u| u.as_str()) {
                out.push(url.to_string());
            } else if let Some(id) = value.get("@id").and_then(|u| u.as_str()) {
                if id.starts_with("http") {
                    out.push(id.to_string());
                }
            }
        }
        _ => {}
    }
}

fn extract_article_hero_image(html: &str, base_url: &str) -> Option<String> {
    let tag_re = Regex::new(r"(?is)<img\b[^>]*>").unwrap();
    let src_re = Regex::new(
        r#"(?is)(?:src|data-src|data-lazy-src|data-original)\s*=\s*["']([^"']+)["']"#,
    )
    .unwrap();
    let mut fallback = None;
    for found in tag_re.find_iter(html) {
        let tag = found.as_str();
        let context = &html[..found.start()];
        let Some(src_cap) = src_re.captures(tag) else {
            continue;
        };
        let src = src_cap.get(1).map(|m| m.as_str()).unwrap_or("");
        if src.is_empty() || is_excluded_image(context, tag, src) || is_tiny_image(tag) {
            continue;
        }
        let Some(abs) = resolve_url(src, base_url) else {
            continue;
        };
        if is_primary_hero(tag) {
            return Some(abs);
        }
        if fallback.is_none() {
            fallback = Some(abs);
        }
    }
    fallback
}

fn is_primary_hero(tag: &str) -> bool {
    let lower = tag.to_ascii_lowercase();
    lower.contains("itemprop=\"image\"")
        || lower.contains("itemprop='image'")
        || lower.contains("wp-post-image")
        || lower.contains("recipe-image")
        || lower.contains("hero")
        || lower.contains("featured")
        || lower.contains("main-image")
        || lower.contains("entry-image")
}

fn is_tiny_image(tag: &str) -> bool {
    let width = declared_dimension(tag, "width");
    let height = declared_dimension(tag, "height");
    match (width, height) {
        (Some(w), Some(h)) => w < 200 || h < 200,
        (Some(w), None) => w < 200,
        (None, Some(h)) => h < 200,
        (None, None) => false,
    }
}

fn declared_dimension(tag: &str, name: &str) -> Option<u32> {
    let pattern = format!(r#"(?i)\b{}\s*=\s*["']?(\d+)"#, regex::escape(name));
    let re = Regex::new(&pattern).ok()?;
    re.captures(tag)?.get(1)?.as_str().parse().ok()
}

fn is_excluded_image(context_before: &str, tag: &str, src: &str) -> bool {
    let hay = format!(
        "{} {} {}",
        ancestor_tags(context_before),
        tag,
        src
    )
    .to_ascii_lowercase();
    const MARKERS: &[&str] = &[
        "sidebar",
        "related-recipe",
        "related_recipe",
        "relatedrecipe",
        "related recipes",
        "related-posts",
        "related-content",
        "you-may-also",
        "similar-recipe",
        "more-recipes",
        "advertisement",
        "adsbygoogle",
        "ad-slot",
        "ad_slot",
        "sponsor",
        "promo",
        "doubleclick",
        "thumbnail",
        "thumb",
        "avatar",
        "logo",
        "icon",
        "sprite",
        "pixel",
        "tracking",
        "spacer",
        "gravatar",
        "widget",
        "recommend",
        "<aside",
        "/ads/",
        "ad-banner",
        "banner-ad",
    ];
    MARKERS.iter().any(|marker| hay.contains(marker)) || is_junk_image_url(src)
}

/// Open elements that wrap the image, so a sidebar or related-recipe block
/// earlier in the page is not treated as the parent of the article photo.
fn ancestor_tags(context: &str) -> String {
    let Ok(tag_re) = Regex::new(r"(?is)<(/?)([a-z0-9]+)\b[^>]*>") else {
        return String::new();
    };
    let mut stack: Vec<String> = Vec::new();
    for cap in tag_re.captures_iter(context) {
        let closing = cap.get(1).map(|m| !m.as_str().is_empty()).unwrap_or(false);
        let name = cap
            .get(2)
            .map(|m| m.as_str().to_ascii_lowercase())
            .unwrap_or_default();
        if matches!(
            name.as_str(),
            "img" | "br" | "hr" | "meta" | "link" | "input" | "source" | "wbr" | "area"
        ) {
            continue;
        }
        if closing {
            if let Some(pos) = stack.iter().rposition(|open| {
                open.to_ascii_lowercase().starts_with(&format!("<{}", name))
            }) {
                stack.truncate(pos);
            }
        } else if let Some(full) = cap.get(0) {
            stack.push(full.as_str().chars().take(220).collect());
        }
    }
    stack.join(" ")
}

fn meta_contents(html: &str, keys: &[&str]) -> Vec<String> {
    let tag_re = Regex::new(r"(?is)<meta\b[^>]*>").unwrap();
    let attr_re = Regex::new(r#"(?is)([\w:-]+)\s*=\s*["']([^"']*)["']"#).unwrap();
    let mut out = Vec::new();
    for tag in tag_re.find_iter(html) {
        let mut property = String::new();
        let mut name = String::new();
        let mut content = String::new();
        for cap in attr_re.captures_iter(tag.as_str()) {
            let attr = cap.get(1).map(|m| m.as_str()).unwrap_or("").to_ascii_lowercase();
            let value = cap.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
            match attr.as_str() {
                "property" => property = value,
                "name" => name = value,
                "content" => content = value,
                _ => {}
            }
        }
        let key = if !property.is_empty() { property } else { name };
        if keys.iter().any(|wanted| wanted.eq_ignore_ascii_case(&key)) && !content.is_empty() {
            out.push(decode_html_entities(&content));
        }
    }
    out
}

fn iter_jsonld(html: &str) -> Vec<Value> {
    let Ok(re) = Regex::new(
        r#"(?is)<script[^>]*type\s*=\s*["']application/ld\+json["'][^>]*>(.*?)</script>"#,
    ) else {
        return Vec::new();
    };
    let mut nodes = Vec::new();
    for cap in re.captures_iter(html) {
        let Some(body) = cap.get(1) else { continue };
        let text = body.as_str().trim();
        if let Ok(value) = serde_json::from_str::<Value>(text) {
            nodes.push(value);
        }
    }
    nodes
}

fn jsonld_nodes(value: &Value) -> Vec<&Value> {
    if let Some(items) = value.as_array() {
        return items.iter().collect();
    }
    if let Some(graph) = value.get("@graph").and_then(|g| g.as_array()) {
        return graph.iter().collect();
    }
    vec![value]
}

fn is_recipe_type(value: &Value) -> bool {
    match value.get("@type") {
        Some(Value::String(kind)) => kind.to_ascii_lowercase().contains("recipe"),
        Some(Value::Array(kinds)) => kinds.iter().any(|kind| {
            kind.as_str()
                .map(|s| s.to_ascii_lowercase().contains("recipe"))
                .unwrap_or(false)
        }),
        _ => false,
    }
}

fn extract_jsonld_recipe(html: &str) -> Option<ParsedRecipe> {
    for node in iter_jsonld(html) {
        for candidate in jsonld_nodes(&node) {
            if !is_recipe_type(candidate) {
                continue;
            }
            let title = decode_html_entities(candidate.get("name").and_then(|v| v.as_str()).unwrap_or("Untitled"));
            let description = decode_html_entities(
                candidate.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            );
            let ingredients = candidate
                .get("recipeIngredient")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .map(|s| parse_ingredient_string(&decode_html_entities(s)))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let steps = candidate
                .get("recipeInstructions")
                .map(collect_instruction_steps)
                .unwrap_or_default();
            let prep_time = candidate
                .get("prepTime")
                .and_then(|v| v.as_str())
                .and_then(parse_iso_duration_to_minutes);
            let cook_time = candidate
                .get("cookTime")
                .and_then(|v| v.as_str())
                .and_then(parse_iso_duration_to_minutes);
            let mut tags: Vec<String> = Vec::new();
            if let Some(kw) = candidate.get("keywords").and_then(|v| v.as_str()) {
                tags.extend(kw.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
            }
            if let Some(cats) = candidate.get("recipeCategory") {
                match cats {
                    Value::String(s) => tags.push(s.clone()),
                    Value::Array(arr) => {
                        tags.extend(arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()));
                    }
                    _ => {}
                }
            }
            let tags = if tags.is_empty() { None } else { Some(tags) };
            if !title.is_empty() && (!ingredients.is_empty() || !steps.is_empty()) {
                return Some(ParsedRecipe {
                    title,
                    description,
                    ingredients,
                    steps,
                    prep_time,
                    cook_time,
                    tags,
                });
            }
        }
    }
    None
}

fn collect_instruction_steps(value: &Value) -> Vec<String> {
    let mut steps = Vec::new();
    match value {
        Value::String(text) => {
            let text = decode_html_entities(text);
            if !text.trim().is_empty() {
                steps.push(text);
            }
        }
        Value::Array(items) => {
            for item in items {
                steps.extend(collect_instruction_steps(item));
            }
        }
        Value::Object(_) => {
            if let Some(nested) = value.get("itemListElement") {
                steps.extend(collect_instruction_steps(nested));
            } else if let Some(text) = value.get("text").and_then(|t| t.as_str()) {
                let text = decode_html_entities(text);
                if !text.trim().is_empty() {
                    steps.push(text);
                }
            }
        }
        _ => {}
    }
    steps
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
    if total_minutes > 0 {
        Some(total_minutes)
    } else {
        None
    }
}

fn parse_ingredient_string(s: &str) -> ParsedIngredient {
    let parts: Vec<&str> = s.splitn(3, ' ').collect();
    let (quantity, unit, name) = match parts.as_slice() {
        [q, u, n] => {
            let qty = q
                .replace('/', " ")
                .split_whitespace()
                .next()
                .and_then(parse_fraction)
                .unwrap_or(1.0);
            (qty, (*u).to_string(), (*n).to_string())
        }
        [q, rest] => {
            let qty = parse_fraction(q).unwrap_or(1.0);
            (qty, "piece".to_string(), (*rest).to_string())
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
        if den != 0.0 {
            return Some(num / den);
        }
    }
    None
}

fn decode_html_entities(s: &str) -> String {
    let mut result = s.to_string();
    result = result.replace("&#039;", "'");
    result = result.replace("&#39;", "'");
    result = result.replace("&apos;", "'");
    result = result.replace("&#8217;", "\u{2019}");
    result = result.replace("&#8216;", "\u{2018}");
    result = result.replace("&#8220;", "\u{201C}");
    result = result.replace("&#8221;", "\u{201D}");
    result = result.replace("&#8211;", "\u{2013}");
    result = result.replace("&#8212;", "\u{2014}");
    result = result.replace("&nbsp;", " ");
    result = result.replace("&quot;", "\"");
    result = result.replace("&lt;", "<");
    result = result.replace("&gt;", ">");
    result = result.replace("&amp;", "&");
    decode_numeric_entities(&result)
}

fn decode_numeric_entities(s: &str) -> String {
    let Ok(re) = Regex::new(r"&#(x?)([0-9a-fA-F]+);") else {
        return s.to_string();
    };
    re.replace_all(s, |caps: &regex::Captures| {
        let hex = caps.get(1).map(|m| !m.as_str().is_empty()).unwrap_or(false);
        let digits = caps.get(2).map(|m| m.as_str()).unwrap_or("");
        let code = if hex {
            u32::from_str_radix(digits, 16).ok()
        } else {
            digits.parse().ok()
        };
        code.and_then(char::from_u32)
            .map(|c| c.to_string())
            .unwrap_or_else(|| caps.get(0).map(|m| m.as_str().to_string()).unwrap_or_default())
    })
    .into_owned()
}

fn resolve_url(url: &str, base_url: &str) -> Option<String> {
    let url = url.trim();
    if url.is_empty() || url.starts_with("data:") || url.starts_with("javascript:") {
        return None;
    }
    if let Some(rest) = url.strip_prefix("//") {
        return Some(format!("https://{}", rest));
    }
    if let Ok(abs) = Url::parse(url) {
        if abs.scheme() == "http" || abs.scheme() == "https" {
            return Some(abs.to_string());
        }
        return None;
    }
    Url::parse(base_url)
        .ok()?
        .join(url)
        .ok()
        .map(|u| u.to_string())
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
    content: Value,
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

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
struct ParsedIngredient {
    name: String,
    quantity: f64,
    unit: String,
}

async fn parse_recipe_with_llm(html: &str) -> Result<ParsedRecipe, ScrapeError> {
    let html = if html.len() > 80_000 { &html[..80_000] } else { html };
    let prompt = format!(
        "You are a recipe extraction expert. Extract the recipe information from the following content and return it as JSON.\n\n\
         Content:\n{}\n\n{}",
        html, JSON_SCHEMA
    );
    call_llm(
        "grok-4.20-0309-reasoning",
        Value::String(prompt),
    )
    .await
}

async fn call_llm(model: &str, content: Value) -> Result<ParsedRecipe, ScrapeError> {
    let api_key = std::env::var("XAI_API_KEY")
        .map_err(|_| ScrapeError::Message("XAI_API_KEY must be set".into()))?;
    let request_body = LlmRequest {
        messages: vec![
            LlmMessage {
                role: "system".to_string(),
                content: Value::String(
                    "You are a recipe parser. Output strictly valid JSON. No markdown. No conversational text."
                        .into(),
                ),
            },
            LlmMessage {
                role: "user".to_string(),
                content,
            },
        ],
        model: model.to_string(),
        stream: false,
        temperature: 0.0,
        response_format: LlmResponseFormat {
            r#type: "text".to_string(),
        },
    };
    let client = Client::new();
    let response = client
        .post("https://api.x.ai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request_body)
        .send()
        .await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(ScrapeError::Message(format!("LLM API error {}: {}", status, body)));
    }
    let llm_response: LlmResponse = response.json().await?;
    let json_text = llm_response
        .choices
        .first()
        .map(|choice| choice.message.content.clone())
        .ok_or_else(|| ScrapeError::Message("Empty model response".into()))?;
    parse_llm_json(&json_text)
}

fn parse_llm_json(json_text: &str) -> Result<ParsedRecipe, ScrapeError> {
    let json_text = json_text.trim();
    let json_text = json_text
        .strip_prefix("```json")
        .or_else(|| json_text.strip_prefix("```"))
        .unwrap_or(json_text);
    let json_text = json_text.strip_suffix("```").unwrap_or(json_text);
    let start = json_text.find('{').unwrap_or(0);
    let end = json_text.rfind('}').unwrap_or(json_text.len().saturating_sub(1));
    if end < start {
        return Err(ScrapeError::Message("Model did not return recipe JSON".into()));
    }
    let json_text = &json_text[start..=end];
    Ok(serde_json::from_str(json_text)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PIN_URL: &str = "https://www.pinterest.com/pin/123456789/";

    fn pin_without_source() -> String {
        r#"<html><head>
            <title>Skillet Cookies | Pinterest</title>
            <meta property="og:title" content="Skillet Cookies"/>
            <meta property="og:description" content="Ingredients: 1 cup butter, 1 cup sugar. Steps: Cream the butter and sugar. Bake 12 minutes."/>
            <meta property="og:image" content="https://i.pinimg.com/originals/aa/bb/cc/cookie.jpg"/>
            <meta property="og:image" content="https://i.pinimg.com/236x/dd/ee/ff/related.jpg"/>
        </head><body>
            <script type="application/json">
            {"link": null, "grid_title": "Skillet Cookies",
             "closeup_description": "Ingredients: 1 cup butter, 1 cup sugar. Steps: Cream the butter and sugar. Bake 12 minutes.",
             "images": {"orig": {"url": "https://i.pinimg.com/originals/aa/bb/cc/cookie.jpg"},
                        "236x": {"url": "https://i.pinimg.com/236x/dd/ee/ff/related.jpg"}}}
            </script>
            <img src="https://i.pinimg.com/236x/11/22/33/another-related.jpg" alt="related recipes thumbnail">
        </body></html>"#
            .to_string()
    }

    #[test]
    fn pinterest_pin_without_source_uses_pin_text_and_main_image() {
        let html = pin_without_source();
        assert_eq!(plan_fetch(PIN_URL, &html), FetchPlan::PinContent);
        let pin = extract_pinterest_pin(&html, PIN_URL);
        assert!(pin.external_source.is_none());
        assert_eq!(pin.title, "Skillet Cookies");
        assert!(pin.text.contains("1 cup butter"), "pin text was {}", pin.text);
        assert!(pin.text.contains("Bake 12 minutes"));
        assert!(
            pin.images.iter().any(|url| url.contains("cookie.jpg")),
            "images: {:?}",
            pin.images
        );
        assert!(
            pin.images.iter().all(|url| !url.contains("236x") && !url.contains("related")),
            "related thumbnails leaked: {:?}",
            pin.images
        );
    }

    #[test]
    fn pinterest_pin_with_source_website_follows_that_url() {
        let html = r#"<html><head>
            <meta property="og:description" content="See the full recipe"/>
        </head><script>{"link":"https://www.simplyrecipes.com/skillet-cookies","tracked_link":"https://www.pinterest.com/pin/1/"}</script></html>"#;
        match plan_fetch(PIN_URL, html) {
            FetchPlan::ExternalSource(url) => {
                assert_eq!(url, "https://www.simplyrecipes.com/skillet-cookies");
            }
            other => panic!("expected external source, got {:?}", other),
        }
    }

    #[test]
    fn pinterest_meta_tags_match_the_live_page_shape() {
        // Pinterest emits content before property, hex entities, a null link, and a 736px closeup.
        let html = r#"<html><head>
            <meta content="https://i.pinimg.com/736x/aa/bb/cc/cake.jpg" data-app="true" name="og:image" property="og:image"/>
            <meta content="Minnie Cake" data-app="true" name="og:title" property="og:title"/>
            <meta content="Ingredients: 2 cups flour, 1 cup sugar. Steps: Mix and bake the cake for the little one&#x27;s birthday." data-app="true" name="og:description" property="og:description"/>
        </head><body><script>{"link":null}</script>
        <img src="https://i.pinimg.com/236x/11/22/33/related.jpg">
        </body></html>"#;
        assert_eq!(plan_fetch(PIN_URL, html), FetchPlan::PinContent);
        let pin = extract_pinterest_pin(html, PIN_URL);
        assert!(pin.external_source.is_none());
        assert_eq!(pin.title, "Minnie Cake");
        assert!(pin.text.contains("one's birthday"), "{}", pin.text);
        assert!(pin.text.contains("2 cups flour"));
        assert_eq!(
            pin.images,
            vec!["https://i.pinimg.com/736x/aa/bb/cc/cake.jpg".to_string()]
        );
    }

    #[test]
    fn social_links_are_not_treated_as_a_recipe_website() {
        let html = r#"<html><head>
            <meta property="og:title" content="Sheet Pan Pancakes"/>
            <meta property="og:description" content="Ingredients: 2 cups flour, 1 tbsp baking powder. Steps: Whisk and bake until golden."/>
        </head><script>{"link":null,"tracked_link":"https://www.instagram.com/p/abc123/"}</script></html>"#;
        assert_eq!(plan_fetch(PIN_URL, html), FetchPlan::PinContent);
        assert!(extract_pinterest_pin(html, PIN_URL).external_source.is_none());
    }

    #[test]
    fn pinterest_link_that_stays_on_pinterest_is_not_an_external_source() {
        let html = r#"<html><head>
            <meta property="og:title" content="No-Link Brownies"/>
            <meta property="og:description" content="Ingredients: 200 g chocolate. Steps: Melt the chocolate and bake."/>
        </head>
        <script>{"link":"https://www.pinterest.com/pin/999999/","tracked_link":"https://i.pinimg.com/originals/aa/bb/cc/photo.jpg"}</script>
        </html>"#;
        assert_eq!(plan_fetch(PIN_URL, html), FetchPlan::PinContent);
        let pin = extract_pinterest_pin(html, PIN_URL);
        assert!(pin.external_source.is_none());
        assert!(pin.text.contains("200 g chocolate"));
    }

    #[test]
    fn short_pin_links_are_pins_and_boards_are_not() {
        assert!(is_pinterest_pin_url("https://pin.it/abc123"));
        assert!(is_pinterest_pin_url("https://www.pinterest.co.uk/pin/42/"));
        assert!(!is_pinterest_pin_url("https://www.pinterest.com/chef/dinner-board/"));
        assert!(!is_pinterest_pin_url("https://example.com/pin/1"));
        let html = r#"<html><script>{"link":"https://example.com/recipe"}</script></html>"#;
        assert_eq!(
            plan_fetch("https://cooking.example/sunday-roast", html),
            FetchPlan::RecipePage
        );
    }

    #[test]
    fn main_images_keep_schema_and_og_and_drop_ads_sidebars_and_related() {
        let html = r#"<html><head>
            <meta property="og:image" content="https://cdn.example.com/main-cake.jpg"/>
            <meta property="og:image" content="https://cdn.example.com/ads/sidebar-banner.jpg"/>
            <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Recipe","name":"Cake",
             "image":["https://cdn.example.com/recipe-hero.jpg","https://cdn.example.com/recipe-plated.jpg"],
             "recipeIngredient":["1 cup flour"],
             "recipeInstructions":[{"@type":"HowToStep","text":"Mix"}]}
            </script>
            <script type="application/ld+json">not json</script>
        </head><body>
            <aside class="sidebar"><img src="https://cdn.example.com/sidebar-thumb.jpg" width="80" height="80"></aside>
            <div class="related-recipes"><img src="https://cdn.example.com/related-thumb.jpg" alt="related recipes thumbnail" width="120" height="120"></div>
            <img class="ad-slot" src="https://cdn.example.com/ad-banner.jpg">
            <article><img class="wp-post-image" src="https://cdn.example.com/article-hero.jpg?w=1200"></article>
        </body></html>"#;
        let images = extract_main_recipe_images(html, "https://cooking.example/cake");
        assert!(images.iter().any(|u| u.contains("recipe-hero.jpg")), "{:?}", images);
        assert!(images.iter().any(|u| u.contains("recipe-plated.jpg")), "{:?}", images);
        assert!(images.iter().any(|u| u.contains("main-cake.jpg")), "{:?}", images);
        for banned in ["sidebar", "related", "ad-banner", "/ads/", "article-hero"] {
            assert!(
                images.iter().all(|u| !u.contains(banned)),
                "{} leaked into {:?}",
                banned,
                images
            );
        }
    }

    #[test]
    fn article_hero_is_used_when_schema_and_og_image_are_missing() {
        let html = r#"<html><body>
            <div class="sidebar"><img src="https://cdn.example.com/sidebar-special.jpg" width="100" height="100"></div>
            <section class="related-recipes">
              <img src="https://cdn.example.com/innocent-looking.jpg" alt="You may also like">
            </section>
            <article>
              <img src="/photos/main.jpg?width=1200" alt="Finished pie">
            </article>
            <img class="sponsor" src="https://cdn.example.com/promo.jpg">
        </body></html>"#;
        let images = extract_main_recipe_images(html, "https://cooking.example/recipes/pie");
        assert_eq!(
            images,
            vec!["https://cooking.example/photos/main.jpg?width=1200".to_string()]
        );
    }

    #[test]
    fn jsonld_recipe_survives_an_earlier_invalid_script() {
        let html = r#"<html>
            <script type="application/ld+json">{not valid</script>
            <script type="application/ld+json">
            {"@type":"Recipe","name":"Soup","description":"Warm bowl",
             "recipeIngredient":["2 cups broth"],
             "recipeInstructions":["Simmer."]}
            </script>
        </html>"#;
        let recipe = extract_jsonld_recipe(html).expect("recipe");
        assert_eq!(recipe.title, "Soup");
        assert_eq!(recipe.ingredients.len(), 1);
        assert_eq!(recipe.steps, vec!["Simmer.".to_string()]);
    }
}
