#!/bin/bash

# Test API end-to-end

BASE_URL="http://localhost:3000"

echo "Testing API..."

# Login (user is pre-seeded)
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"Test123!"}')
echo "Login response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi
echo "Token: $TOKEN"

# Add recipe
echo "Adding recipe..."
RECIPE_DATA='{"title":"Test Recipe","ingredients":[{"name":"flour","quantity":"1 cup","unit":"cups"}],"steps":["Mix ingredients","Bake at 350F"],"tags":["dessert","baking"],"description":"A simple test recipe"}'
ADD_RESPONSE=$(curl -s -X POST "$BASE_URL/recipes" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$RECIPE_DATA")
echo "Add recipe response: $ADD_RESPONSE"

RECIPE_ID=$(echo $ADD_RESPONSE | jq -r '.id')
if [ "$RECIPE_ID" = "null" ] || [ -z "$RECIPE_ID" ]; then
  echo "Failed to add recipe"
  exit 1
fi
echo "Recipe ID: $RECIPE_ID"

# Get recipes
echo "Getting recipes..."
GET_RESPONSE=$(curl -s "$BASE_URL/recipes" -H "Authorization: Bearer $TOKEN")
echo "Get recipes response: $GET_RESPONSE"

# Search recipes
echo "Searching recipes by tags..."
SEARCH_RESPONSE=$(curl -s "$BASE_URL/recipes/search?tags=dessert" -H "Authorization: Bearer $TOKEN")
echo "Search recipes response: $SEARCH_RESPONSE"

# Update recipe
echo "Updating recipe..."
UPDATE_DATA='{"title":"Updated Test Recipe","ingredients":[{"name":"flour","quantity":"2 cups","unit":"cups"}],"steps":["Mix ingredients well","Bake at 375F"],"tags":["dessert","baking","updated"],"description":"An updated test recipe"}'
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/recipes/$RECIPE_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$UPDATE_DATA")
echo "Update recipe response: $UPDATE_RESPONSE"

# Delete recipe
echo "Deleting recipe..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/recipes/$RECIPE_ID" -H "Authorization: Bearer $TOKEN")
echo "Delete recipe response: $DELETE_RESPONSE"

echo "API test completed successfully!"