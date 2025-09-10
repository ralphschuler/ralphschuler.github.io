#!/usr/bin/env bash

set -euo pipefail

HEXO_API_URL="https://ralphschuler.github.io/api"

die() {
    echo "Error: $1" >&2
    exit 1
}

fetch() {
    local url="$1"
    local response="$(curl -sfL "$url")"

    if [[ -z "$response" ]]; then
        die "Failed to fetch $url"
    fi

    echo "$response"
}

main() {

}
