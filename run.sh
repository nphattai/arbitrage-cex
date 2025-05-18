#!/bin/bash

# Default values
SPREAD_THRESHOLD=${SPREAD_THRESHOLD:-"0.005"}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-""}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-""}

# Check if required environment variables are set
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set"
    echo "Usage: TELEGRAM_BOT_TOKEN=your_token TELEGRAM_CHAT_ID=your_chat_id ./run.sh"
    exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t arbitrage-monitor .

# Function to create and run container for a token
run_token_container() {
    local symbol=$1
    local primary_exchange=$2
    local secondary_exchange=$3
    local container_name="arbitrage-${symbol//\//-}-${primary_exchange}-${secondary_exchange}"
    
    echo "Setting up container for $symbol ($primary_exchange -> $secondary_exchange)..."
    
    # Stop and remove existing container if it exists
    echo "Cleaning up existing container for $symbol..."
    docker stop $container_name 2>/dev/null
    docker rm $container_name 2>/dev/null

    # Run the container
    echo "Starting container for $symbol..."
    docker run -d \
        --name $container_name \
        --restart unless-stopped \
        -e TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN} \
        -e TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID} \
        -e SYMBOL=${symbol} \
        -e PRIMARY_EXCHANGE=${primary_exchange} \
        -e SECONDARY_EXCHANGE=${secondary_exchange} \
        -e SPREAD_THRESHOLD=${SPREAD_THRESHOLD} \
        arbitrage-monitor

    echo "Container $container_name started for $symbol"
}

# Read tokens from file and run containers
echo "Starting containers for all tokens..."
while IFS=',' read -r symbol primary_exchange secondary_exchange || [ -n "$symbol" ]; do
    # Skip empty lines and comments
    [[ -z "$symbol" || "$symbol" =~ ^[[:space:]]*# ]] && continue
    
    # Remove any whitespace
    symbol=$(echo "$symbol" | xargs)
    primary_exchange=$(echo "$primary_exchange" | xargs)
    secondary_exchange=$(echo "$secondary_exchange" | xargs)
    
    if [ ! -z "$symbol" ] && [ ! -z "$primary_exchange" ] && [ ! -z "$secondary_exchange" ]; then
        run_token_container "$symbol" "$primary_exchange" "$secondary_exchange"
    fi
done < tokens.txt
