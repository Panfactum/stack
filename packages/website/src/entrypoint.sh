#!/usr/bin/env bash

function replace() {
  find .next -type f -name '*.js' -exec sed -i "s|@$1@|${!1}|g" {} +
}

replace NEXT_PUBLIC_API_URL

exec "$@"
