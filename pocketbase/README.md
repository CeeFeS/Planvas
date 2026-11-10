# Planvas - PocketBase Backend

This directory contains the PocketBase backend for Planvas.

## Quick Start

### 1. Start PocketBase

```bash
# From the project root. Publishes PocketBase on http://127.0.0.1:8090
npm run pocketbase:start
```

### 2. Create an admin account

1. Open http://127.0.0.1:8090/_/
2. Create an admin account on the first visit
3. Collections are created automatically by migrations

### 3. Start the frontend

```bash
npm run dev
```

The app is available at http://localhost:3000.

## Collections

The following collections are created automatically:

| Collection | Description |
|------------|-------------|
| `projects` | Top-level projects |
| `tasks` | Tasks inside a project |
| `resources` | Resources assigned to tasks |
| `allocations` | Time-based resource assignments |

## API rules

By default every collection is readable and writable by every user (for development).

**Tighten the rules before production.**

Example of project-based access control:
```
listRule: @request.auth.id != ""
createRule: @request.auth.id != ""
updateRule: @request.auth.id = user_id
deleteRule: @request.auth.id = user_id
```

## Realtime

PocketBase provides realtime updates over WebSockets.
The app uses them to keep users in sync.

## Commands

```bash
# Start PocketBase
npm run pocketbase:start

# Stop PocketBase
npm run pocketbase:stop

# Show logs
npm run pocketbase:logs

# Remove the container completely (including data)
docker compose down -v
```

## Data persistence

Data is stored in the Docker volume `tinyplanvas_pocketbase_data`.

To back it up:
```bash
docker cp planvas-pocketbase:/pb/pb_data ./backup_pb_data
```

## Ports

| Service | Port |
|---------|------|
| PocketBase API | 8090 |
| PocketBase Admin | 8090/_/ |
