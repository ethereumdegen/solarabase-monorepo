use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use governor::clock::DefaultClock;
use governor::state::keyed::DashMapStateStore;
use governor::{Quota, RateLimiter};
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;

use crate::error::AppError;

pub type KeyedRateLimiter = RateLimiter<IpAddr, DashMapStateStore<IpAddr>, DefaultClock>;

/// Create a per-IP rate limiter: `per_second` sustained rate, `burst` max burst.
pub fn create_limiter(per_second: u32, burst: u32) -> Arc<KeyedRateLimiter> {
    let quota = Quota::per_second(NonZeroU32::new(per_second).expect("per_second > 0"))
        .allow_burst(NonZeroU32::new(burst).expect("burst > 0"));
    Arc::new(RateLimiter::dashmap(quota))
}

/// Extract client IP from proxy headers or socket.
fn extract_ip(req: &Request<Body>) -> IpAddr {
    if let Some(xff) = req.headers().get("x-forwarded-for") {
        if let Ok(val) = xff.to_str() {
            if let Some(first) = val.split(',').next() {
                if let Ok(ip) = first.trim().parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }
    if let Some(xri) = req.headers().get("x-real-ip") {
        if let Ok(val) = xri.to_str() {
            if let Ok(ip) = val.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }
    if let Some(connect_info) = req.extensions().get::<ConnectInfo<SocketAddr>>() {
        return connect_info.0.ip();
    }
    IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED)
}

/// Axum middleware function — use with `axum::middleware::from_fn`.
/// The limiter is injected via Extension.
pub async fn check_rate_limit(
    req: Request<Body>,
    next: Next,
) -> Response {
    let limiter = req.extensions().get::<Arc<KeyedRateLimiter>>().cloned();
    let ip = extract_ip(&req);
    if let Some(limiter) = limiter {
        if limiter.check_key(&ip).is_err() {
            return AppError::RateLimited.into_response();
        }
    }
    next.run(req).await
}
