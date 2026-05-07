use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::extractors::AuthUser;
use crate::db;
use crate::error::{AppError, AppResult};
use crate::middleware::plan_limits;
use crate::models::workspace::WorkspaceRole;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateWorkspace {
    pub name: String,
    pub slug: String,
}

pub async fn list(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<serde_json::Value>> {
    let workspaces = db::workspaces::list_for_user(&state.db, user.id).await?;
    Ok(Json(serde_json::json!(workspaces)))
}

pub async fn create(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Json(req): Json<CreateWorkspace>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let ws = db::workspaces::create(&state.db, &req.name, &req.slug, user.id)
        .await
        .map_err(|e| {
            if let AppError::Database(ref db_err) = e {
                let msg = db_err.to_string();
                if msg.contains("duplicate key") || msg.contains("unique constraint") {
                    return AppError::BadRequest("workspace slug already exists".into());
                }
            }
            e
        })?;
    db::subscriptions::get_or_create_free(&state.db, ws.id).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!(ws))))
}

pub async fn get(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let _membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    let ws = db::workspaces::get_by_id(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;
    Ok(Json(serde_json::json!(ws)))
}

#[derive(Deserialize)]
pub struct UpdateWorkspace {
    pub name: String,
}

pub async fn update(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
    Json(req): Json<UpdateWorkspace>,
) -> AppResult<Json<serde_json::Value>> {
    let membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    if membership.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required".into()));
    }
    let ws = db::workspaces::update(&state.db, ws_id, &req.name).await?;
    Ok(Json(serde_json::json!(ws)))
}

pub async fn delete(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let ws = db::workspaces::get_by_id(&state.db, ws_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;
    if ws.owner_id != user.id {
        return Err(AppError::Forbidden("only owner can delete workspace".into()));
    }
    db::workspaces::delete(&state.db, ws_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_members(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let _membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    let members = db::workspaces::list_members(&state.db, ws_id).await?;
    Ok(Json(serde_json::json!(members)))
}

#[derive(Deserialize)]
pub struct InviteRequest {
    pub email: String,
    pub role: Option<WorkspaceRole>,
}

pub async fn invite(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path(ws_id): Path<Uuid>,
    Json(req): Json<InviteRequest>,
) -> AppResult<(StatusCode, Json<serde_json::Value>)> {
    let membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    if membership.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required to invite".into()));
    }

    plan_limits::check_member_limit(&state.db, ws_id).await?;

    let role = req.role.unwrap_or(WorkspaceRole::Member);
    let token = hex::encode(rand::random::<[u8; 16]>());
    let inv = db::invitations::create(&state.db, ws_id, &req.email, &role, user.id, &token).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!(inv))))
}

pub async fn remove_member(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Path((ws_id, user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let membership = db::workspaces::get_membership(&state.db, ws_id, user.id)
        .await?
        .ok_or_else(|| AppError::Forbidden("not a member".into()))?;
    if membership.role == WorkspaceRole::Member {
        return Err(AppError::Forbidden("admin required".into()));
    }
    db::workspaces::remove_member(&state.db, ws_id, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/invitations/accept?token=X
pub async fn accept_invite(
    AuthUser(user): AuthUser,
    State(state): State<AppState>,
    Query(params): Query<AcceptInviteParams>,
) -> AppResult<Json<serde_json::Value>> {
    let inv = db::invitations::get_by_token(&state.db, &params.token)
        .await?
        .ok_or_else(|| AppError::NotFound("invitation not found or expired".into()))?;

    db::workspaces::add_member(&state.db, inv.workspace_id, user.id, &inv.role).await?;
    db::invitations::accept(&state.db, inv.id).await?;

    let ws = db::workspaces::get_by_id(&state.db, inv.workspace_id)
        .await?
        .ok_or_else(|| AppError::NotFound("workspace not found".into()))?;

    Ok(Json(serde_json::json!(ws)))
}

use axum::extract::Query;
#[derive(Deserialize)]
pub struct AcceptInviteParams {
    pub token: String,
}
