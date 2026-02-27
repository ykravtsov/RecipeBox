#!/bin/bash

# Test API end-to-end

BASE_URL="http://localhost:3000"

echo "Testing API..."

# Register
echo "Registering user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"Test123!"}')
echo "Register response: $REGISTER_RESPONSE"

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi
echo "Token: $TOKEN"

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"Test123!"}')
echo "Login response: $LOGIN_RESPONSE"

LOGIN_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
if [ "$LOGIN_TOKEN" = "null" ] || [ -z "$LOGIN_TOKEN" ]; then
  echo "Failed to login"
  exit 1
fi
echo "Login token: $LOGIN_TOKEN"

# Add recipe
echo "Adding recipe..."
RECIPE_DATA='{"title":"Test Recipe","ingredients":[{"name":"flour","quantity":"1 cup"}],"instructions":"Mix and bake"}'
ADD_RESPONSE=$(curl -s -X POST "$BASE_URL/recipes" -H "Content-Type: application/json" -H "Authorization: Bearer $LOGIN_TOKEN" -d "$RECIPE_DATA")
echo "Add recipe response: $ADD_RESPONSE"

RECIPE_ID=$(echo $ADD_RESPONSE | jq -r '.id')
if [ "$RECIPE_ID" = "null" ] || [ -z "$RECIPE_ID" ]; then
  echo "Failed to add recipe"
  exit 1
fi
echo "Recipe ID: $RECIPE_ID"

# Get recipes
echo "Getting recipes..."
GET_RESPONSE=$(curl -s "$BASE_URL/recipes" -H "Authorization: Bearer $LOGIN_TOKEN")
echo "Get recipes response: $GET_RESPONSE"

# Update recipe
echo "Updating recipe..."
UPDATE_DATA='{"title":"Updated Test Recipe","ingredients":[{"name":"flour","quantity":"2 cups"}],"instructions":"Mix well and bake"}'
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/recipes/$RECIPE_ID" -H "Content-Type: application/json" -H "Authorization: Bearer $LOGIN_TOKEN" -d "$UPDATE_DATA")
echo "Update recipe response: $UPDATE_RESPONSE"

# Delete recipe
echo "Deleting recipe..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/recipes/$RECIPE_ID" -H "Authorization: Bearer $LOGIN_TOKEN")
echo "Delete recipe response: $DELETE_RESPONSE"

echo "API test completed successfully!"