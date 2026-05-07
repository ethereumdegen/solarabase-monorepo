use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use uuid::Uuid;

use crate::db;
use crate::error::AppError;
use crate::models::knowledgebase::{KbRole, Knowledgebase};
use crate::models::user::User;
use crate::models::workspace::WorkspaceRole;
use crate::state::AppState;

use super::api_key::hash_api_key;
use super::jwt::verify_jwt;

/// Extracts authenticated user from JWT cookie or API key header.
pub struct AuthUser(pub User);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Try JWT cookie first
        if let Some(cookie_header) = parts.headers.get("cookie") {
            if let Ok(cookies) = cookie_header.to_str() {
                for cookie in cookies.split(';') {
                    let cookie = cookie.trim();
                    if let Some(token) = cookie.strip_prefix("sb_session=") {
                        if let Ok(claims) = verify_jwt(token, &state.config.jwt_secret) {
                            if let Some(user) =
                                db::users::get_by_id(&state.db, claims.sub).await?
                            {
                                return Ok(AuthUser(user));
                            }
                        }
                    }
                }
            }
        }

        Err(AppError::Unauthorized)
    }
}

/// Extracts KB access: validates user has access to a KB via workspace membership OR API key.
/// If the KB has explicit kb_memberships, only listed users + workspace owners/admins get access.
/// Expects `kb_id` in the URL path.
pub struct KbAccess {
    pub user: User,
    pub kb: Knowledgebase,
    pub role: WorkspaceRole,
    pub kb_role: Option<KbRole>,
    pub via_api_key: bool,
}

impl FromRequestParts<AppState> for KbAccess {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Extract kb_id from path
        let kb_id = extract_kb_id(parts)?;

        // Try API key auth first (Authorization: Bearer sb_live_...)
        if let Some(auth_header) = parts.headers.get("authorization") {
            if let Ok(header_str) = auth_header.to_str() {
                if let Some(raw_key) = header_str.strip_prefix("Bearer ") {
                    if raw_key.starts_with("sb_live_") {
                        let key_hash = hash_api_key(raw_key);
                        if let Some(api_key) =
                            db::api_keys::validate_key(&state.db, &key_hash).await?
                        {
                            if api_key.kb_id != kb_id {
                                return Err(AppError::Forbidden(
                                    "API key does not match this knowledgebase".into(),
                                ));
                            }

                            let kb = db::knowledgebases::get_by_id(&state.db, kb_id)
                                .await?
                                .ok_or_else(|| {
                                    AppError::NotFound("knowledgebase not found".into())
                                })?;

                            // Use the key creator as the user
                            let user = db::users::get_by_id(&state.db, api_key.created_by)
                                .await?
                                .ok_or(AppError::Unauthorized)?;

                            return Ok(KbAccess {
                                user,
                                kb,
                                role: WorkspaceRole::Member,
                                kb_role: None,
                                via_api_key: true,
                            });
                        }
                        return Err(AppError::Unauthorized);
                    }
                }
            }
        }

        // Fall back to cookie auth
        let auth_user = AuthUser::from_request_parts(parts, state).await?;
        let user = auth_user.0;

        let kb = db::knowledgebases::get_by_id(&state.db, kb_id)
            .await?
            .ok_or_else(|| AppError::NotFound("knowledgebase not found".into()))?;

        // Check workspace membership
        let membership =
            db::workspaces::get_membership(&state.db, kb.workspace_id, user.id)
                .await?
                .ok_or_else(|| AppError::Forbidden("not a member of this workspace".into()))?;

        // Check KB-level access if KB has explicit memberships
        let kb_role = if db::knowledgebases::kb_has_memberships(&state.db, kb_id).await? {
            // Workspace owners/admins always have access
            if membership.role == WorkspaceRole::Owner || membership.role == WorkspaceRole::Admin {
                Some(KbRole::Admin)
            } else {
                // Must have explicit KB membership
                let kb_membership = db::knowledgebases::get_kb_membership(&state.db, kb_id, user.id)
                    .await?
                    .ok_or_else(|| AppError::Forbidden("no access to this knowledgebase".into()))?;
                Some(kb_membership.role)
            }
        } else {
            None // No KB-level restrictions, workspace membership sufficient
        };

        Ok(KbAccess {
            user,
            kb,
            role: membership.role,
            kb_role,
            via_api_key: false,
        })
    }
}

impl KbAccess {
    /// Returns true if user has at least editor-level write access.
    pub fn can_write(&self) -> bool {
        if self.via_api_key {
            return true; // API keys grant write access
        }
        match self.role {
            WorkspaceRole::Owner | WorkspaceRole::Admin => true,
            WorkspaceRole::Member => match self.kb_role {
                Some(KbRole::Admin) | Some(KbRole::Editor) => true,
                Some(KbRole::Viewer) => false,
                None => true, // No KB-level restrictions
            },
        }
    }

    /// Returns true if user has admin access to KB.
    pub fn can_admin(&self) -> bool {
        if self.via_api_key {
            return false;
        }
        match self.role {
            WorkspaceRole::Owner | WorkspaceRole::Admin => true,
            WorkspaceRole::Member => self.kb_role == Some(KbRole::Admin),
        }
    }
}

fn extract_kb_id(parts: &Parts) -> Result<Uuid, AppError> {
    let path = parts.uri.path();
    // Path format: /api/kb/{kb_id}/...
    let segments: Vec<&str> = path.split('/').collect();
    for (i, seg) in segments.iter().enumerate() {
        if *seg == "kb" {
            if let Some(id_str) = segments.get(i + 1) {
                return Uuid::parse_str(id_str)
                    .map_err(|_| AppError::BadRequest("invalid kb_id".into()));
            }
        }
    }
    Err(AppError::BadRequest("kb_id not found in path".into()))
}
